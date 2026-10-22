"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { headingCount, outlineOf, parseDoc } from "@/lib/outline";

/**
 * Document reader for a lesson note.
 * - Renders the note as a real document: topics (h2) and subtopics (h3) become
 *   headings, bullets become lists.
 * - Shows the topic/subtopic outline beside it and scrolls to a section on click.
 * - PDF lessons keep the original file one click away.
 */
export default function DocReader({
  text,
  title,
  pdfUrl,
}: {
  text: string;
  title: string;
  pdfUrl?: string | null;
}) {
  const blocks = useMemo(() => parseDoc(text), [text]);
  const topics = useMemo(() => outlineOf(blocks), [blocks]);
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string>("");
  const [showPdf, setShowPdf] = useState(false);
  const hasOutline = topics.length > 0 && headingCount(blocks) > 1;

  const go = (id: string) => {
    const el = scroller.current?.querySelector(
      "#" + CSS.escape(id),
    ) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  };

  // highlight the section currently in view
  useEffect(() => {
    const root = scroller.current;
    if (!root || !hasOutline) return;
    const heads = [...root.querySelectorAll("h2[id],h3[id]")] as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { root, rootMargin: "0px 0px -70% 0px", threshold: 0 },
    );
    heads.forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, [hasOutline, blocks]);

  if (!blocks.length && !pdfUrl)
    return <p className="muted">This note is empty.</p>;

  return (
    <div className="doc-wrap">
      <div
        className={`doc-shell ${hasOutline && !showPdf ? "has-outline" : ""}`}
      >
        {showPdf && pdfUrl ? (
          <div style={{ width: "100%" }}>
            <iframe className="pdf" src={pdfUrl} title={title} />
          </div>
        ) : (
          <div className="doc-scroll" ref={scroller}>
            <article className="doc" aria-label={title}>
              {blocks.map((b, i) => {
                if (b.type === "h1")
                  return (
                    <h1 key={i} className="doc-title">
                      {b.text}
                    </h1>
                  );
                if (b.type === "h2")
                  return (
                    <h2 key={i} id={b.id}>
                      {b.text}
                    </h2>
                  );
                if (b.type === "h3")
                  return (
                    <h3 key={i} id={b.id}>
                      {b.text}
                    </h3>
                  );
                if (b.type === "li")
                  return (
                    <li key={i} className="doc-li">
                      {b.text}
                    </li>
                  );
                return <p key={i}>{b.text}</p>;
              })}
            </article>
            {pdfUrl && (
              <p className="doc-src muted">
                Converted from the uploaded document.
              </p>
            )}
          </div>
        )}

        {hasOutline && !showPdf && (
          <nav className="doc-outline" aria-label="Document outline">
            <b className="doc-outline-head">Topics</b>
            {topics.map((t) => (
              <div key={t.id} className="doc-outline-group">
                <a
                  href={`#${t.id}`}
                  className={`doc-t ${active === t.id ? "on" : ""}`}
                  onClick={(e) => {
                    e.preventDefault();
                    go(t.id);
                  }}
                >
                  {t.text}
                </a>
                {t.children.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className={`doc-s ${active === s.id ? "on" : ""}`}
                    onClick={(e) => {
                      e.preventDefault();
                      go(s.id);
                    }}
                  >
                    {s.text}
                  </a>
                ))}
              </div>
            ))}
          </nav>
        )}
      </div>

      {pdfUrl && (
        <p className="doc-switch">
          <button
            type="button"
            className="btn sm"
            onClick={() => setShowPdf((v) => !v)}
          >
            {showPdf ? "Read as text" : "View original PDF"}
          </button>
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
            Open PDF in a new tab
          </a>
        </p>
      )}
    </div>
  );
}
