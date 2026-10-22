// Turns a lesson note into a readable outline: topics (h2), subtopics (h3),
// bullets, paragraphs — and derives the outline tree shown beside the document.
// Understands plain prose, Markdown-ish notes (`#`/`##`/`###`, `-` bullets)
// and notes that number their sections ("1. Topic", "1.1 Subtopic").

export type Block =
  | { type: "h1" | "h2" | "h3"; text: string; id: string }
  | { type: "p" | "li"; text: string }
  | { type: "callout"; text: string };

export interface Topic {
  id: string;
  text: string;
  children: { id: string; text: string }[];
}

const slug = (s: string, i: number) =>
  "sec-" +
  i +
  "-" +
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

const NUMERIC = /^(\d+(?:\.\d+)*)\.?\s+(.{2,})$/;
const SHORT_LINE = /^[A-Z0-9][^.!?]{2,80}$/;

/** Split raw note text into blocks. */
export function parseDoc(raw: string): Block[] {
  const text = (raw || "").replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ");
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (!para.length) return;
    const t = para.join(" ").replace(/\s+/g, " ").trim();
    para = [];
    if (t) blocks.push({ type: "p", text: t });
  };

  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) {
      flush();
      continue;
    }

    // Markdown-style headings
    const md = /^(#{1,4})\s+(.+)$/.exec(t);
    if (md) {
      flush();
      const level = md[1].length;
      blocks.push({
        type: level === 1 ? "h1" : level === 2 ? "h2" : "h3",
        text: md[2].trim(),
        id: "",
      });
      continue;
    }
    // Bullets
    const li = /^[-*•–]\s+(.+)$/.exec(t);
    if (li) {
      flush();
      blocks.push({ type: "li", text: li[1].trim() });
      continue;
    }
    // Numbered sections: "1. Topic" → h2, "1.2 Subtopic" → h3
    const num = NUMERIC.exec(t);
    if (num && !/[.!?]$/.test(t)) {
      flush();
      const depth = num[1].split(".").length;
      blocks.push({ type: depth <= 1 ? "h2" : "h3", text: t, id: "" });
      continue;
    }
    // A short standalone line inside a note usually titles the next part
    if (SHORT_LINE.test(t) && !para.length) {
      flush();
      blocks.push({ type: "h2", text: t, id: "" });
      continue;
    }
    para.push(t);
  }
  flush();

  // Give headings stable ids and promote a leading title to h1
  const used = new Map<string, number>();
  blocks.forEach((b, i) => {
    if (b.type !== "h1" && b.type !== "h2" && b.type !== "h3") return;
    let id = slug(b.text, i);
    const n = used.get(id) ?? 0;
    used.set(id, n + 1);
    if (n) id += "-" + n;
    b.id = id;
  });

  // If the note has no explicit headings at all, treat its paragraphs as plain text.
  return blocks;
}

/** Topic/subtopic tree for the outline panel. */
export function outlineOf(blocks: Block[]): Topic[] {
  const topics: Topic[] = [];
  for (const b of blocks) {
    if (b.type === "h1") continue;
    if (b.type === "h2") topics.push({ id: b.id, text: b.text, children: [] });
    else if (b.type === "h3") {
      const last = topics[topics.length - 1];
      if (last) last.children.push({ id: b.id, text: b.text });
      else topics.push({ id: b.id, text: b.text, children: [] });
    }
  }
  return topics;
}

/** How many headings a note has — used to decide whether an outline is worth showing. */
export const headingCount = (blocks: Block[]) =>
  blocks.filter((b) => b.type === "h2" || b.type === "h3").length;
