"""Extract a study outline and timing estimates from a PDF using PyMuPDF."""

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

import pymupdf

WORDS_PER_MINUTE = 180
MAX_HEADING_LEN = 90


def time_category(minutes):
    if minutes < 10:
        return {"key": "quick", "label": "Quick read", "hint": "Under 10 min"}
    if minutes < 30:
        return {"key": "short", "label": "Short session", "hint": "10-29 min"}
    if minutes < 60:
        return {"key": "medium", "label": "About an hour", "hint": "30-59 min"}
    return {"key": "long", "label": "Deep dive", "hint": "60+ min"}


def outline_from_bookmarks(doc):
    return [
        {"level": level, "title": title.strip(), "start_page": page}
        for level, title, page in doc.get_toc(simple=True)
        if title.strip() and 1 <= page <= len(doc)
    ]


def outline_from_fonts(doc):
    sizes = Counter()
    lines = []

    for page_number, page in enumerate(doc, start=1):
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                spans = [span for span in line["spans"] if span["text"].strip()]
                if not spans:
                    continue
                text = " ".join(span["text"].strip() for span in spans).strip()
                size = round(max(span["size"] for span in spans), 1)
                bold = all(
                    bool(span["flags"] & 16) or "bold" in span["font"].lower()
                    for span in spans
                )
                sizes[size] += len(text)
                lines.append((page_number, size, bold, text))

    if not sizes:
        return []

    body_size = sizes.most_common(1)[0][0]
    candidates = []
    for page_number, size, bold, text in lines:
        if len(text) > MAX_HEADING_LEN or len(text) < 3:
            continue
        if re.fullmatch(r"[\d\s.\-]+", text):
            continue
        if text.endswith((".", ",", ";")) and not re.match(r"^\d+(\.\d+)*\s", text):
            continue
        if size >= body_size + 1.5 or (bold and size >= body_size):
            candidates.append((page_number, size, text))

    if not candidates:
        return []

    distinct_sizes = sorted({candidate[1] for candidate in candidates}, reverse=True)[:3]
    level_by_size = {size: index + 1 for index, size in enumerate(distinct_sizes)}
    outline = []
    seen = set()
    for page_number, size, text in candidates:
        if size not in level_by_size:
            continue
        key = (page_number, text.lower())
        if key in seen:
            continue
        seen.add(key)
        outline.append({
            "level": level_by_size[size],
            "title": text,
            "start_page": page_number,
        })
    return outline


def build_outline(doc):
    outline = outline_from_bookmarks(doc)
    source = "bookmarks"
    if not outline:
        outline = outline_from_fonts(doc)
        source = "font-detection"
    if not outline:
        step = 10
        outline = [
            {
                "level": 1,
                "title": f"Pages {page}-{min(page + step - 1, len(doc))}",
                "start_page": page,
            }
            for page in range(1, len(doc) + 1, step)
        ]
        source = "page-chunks"
    return outline, source


def section_end_pages(outline, total_pages):
    for index, item in enumerate(outline):
        end_page = total_pages
        for following in outline[index + 1:]:
            if following["level"] <= item["level"]:
                end_page = max(item["start_page"], following["start_page"] - 1)
                break
        item["end_page"] = max(item["start_page"], end_page)


def analyze(pdf_path):
    with pymupdf.open(pdf_path) as doc:
        total_pages = len(doc)
        outline, source = build_outline(doc)
        section_end_pages(outline, total_pages)
        page_text = {}

        def words_for_page(page_number):
            if page_number not in page_text:
                page_text[page_number] = doc[page_number - 1].get_text("text")
            return page_text[page_number]

        for index, item in enumerate(outline, start=1):
            text = " ".join(
                words_for_page(page_number)
                for page_number in range(item["start_page"], item["end_page"] + 1)
            )
            text = re.sub(r"\s+", " ", text).strip()
            words = len(text.split())
            minutes = max(1, round(words / WORDS_PER_MINUTE))
            excerpt = text
            heading_position = excerpt.lower().find(item["title"].lower())
            if heading_position >= 0:
                excerpt = excerpt[heading_position + len(item["title"]):].strip()
            if len(excerpt) > 280:
                excerpt = excerpt[:280].rsplit(" ", 1)[0] + "..."

            item.update({
                "id": index,
                "words": words,
                "minutes": minutes,
                "category": time_category(minutes),
                "excerpt": excerpt,
            })

        total_words = sum(len(page.get_text("text").split()) for page in doc)
        total_minutes = max(1, round(total_words / WORDS_PER_MINUTE))
        title = (doc.metadata or {}).get("title", "").strip()
        if not title or title.lower() in ("(anonymous)", "untitled"):
            title = Path(pdf_path).stem

        return {
            "title": title,
            "total_pages": total_pages,
            "total_minutes": total_minutes,
            "total_category": time_category(total_minutes),
            "outline_source": source,
            "sections": nest(outline),
            "flat": outline,
        }


def nest(outline):
    root = {"children": [], "level": 0}
    stack = [root]
    for section in outline:
        item = {**section, "children": []}
        while stack[-1]["level"] >= item["level"]:
            stack.pop()
        stack[-1]["children"].append(item)
        stack.append(item)
    return root["children"]


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf")
    parser.add_argument("--json", action="store_true", help="Write the analysis result as JSON")
    args = parser.parse_args()
    result = analyze(args.pdf)
    if args.json:
        print(json.dumps(result, ensure_ascii=False))
    else:
        print(f"{result['title']}: {result['total_pages']} pages, ~{result['total_minutes']} min "
              f"(outline from {result['outline_source']})")
        for section in result["flat"]:
            print(f"{'  ' * (section['level'] - 1)}- {section['title']}  "
                  f"[p.{section['start_page']}-{section['end_page']}, "
                  f"{section['minutes']} min, {section['category']['label']}]")


if __name__ == "__main__":
    main()
