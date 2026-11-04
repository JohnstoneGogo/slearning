"use client";

import type { PdfOutlineData, PdfSection } from "@/lib/pdf-outline";
import { useEffect, useState } from "react";
import SectionLearningWindow from "@/components/SectionLearningWindow";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/components/Providers";

interface SectionStatus {
  section_id: number;
  unlocked: boolean;
  completed: boolean;
  best_score: number;
  attempts: number;
}

export function PdfOutlineView({
  outline,
  lessonId,
  onSectionSelect,
  activeId,
  showPageRanges = true,
  showTotal = true,
}: {
  outline: PdfOutlineData;
  lessonId?: number;
  onSectionSelect?: (section: PdfSection) => void;
  activeId?: string;
  showPageRanges?: boolean;
  showTotal?: boolean;
}) {
  const { me, toast } = useAuth();
  const [selectedSection, setSelectedSection] = useState<PdfSection | null>(null);
  const [statuses, setStatuses] = useState<Record<number, SectionStatus>>({});
  useEffect(() => {
    let cancelled = false;
    setStatuses({});
    if (!lessonId || !me) return () => { cancelled = true; };
    void api<{ sections: SectionStatus[] }>(`/lessons/${lessonId}/sections/progress`)
      .then(result => {
        if (!cancelled) setStatuses(Object.fromEntries(result.sections.map(status => [status.section_id, status])));
      })
      .catch((cause: unknown) => {
        if (!cancelled) toast(errMsg(cause));
      });
    return () => { cancelled = true; };
  }, [lessonId, me, toast]);

  return (
    <>
      <nav className="doc-outline" aria-label="PDF outline">
        {showTotal && (
          <>
            <b className="doc-outline-head">PDF outline</b>
            <small className="doc-outline-total">
              About {outline.total_minutes} min
              {outline.total_pages ? ` · ${outline.total_pages} pages` : ""}
            </small>
          </>
        )}
        {outline.flat.map((section) => {
          const status = statuses[section.id];
          const locked = Boolean(me && status && !status.unlocked);
          const content = (
            <>
              <span>{section.title}</span>
              {showPageRanges && section.start_page && (
                <small>
                  p. {section.start_page}
                  {section.end_page && section.end_page !== section.start_page
                    ? `–${section.end_page}`
                    : ""}
                </small>
              )}
              <span className="doc-time-badge">
                {section.minutes} min · {section.category.label}
              </span>
              {status?.completed && <span className="doc-section-status">Passed · {status.best_score}%</span>}
              {locked && <span className="doc-section-status locked">Locked · pass the previous quiz</span>}
            </>
          );
          const className = `doc-pdf-link${activeId === `pdf-${section.id}` ? " on" : ""}${locked ? " locked" : ""}`;
          const style = {
            marginLeft: `${Math.max(0, section.level - 1) * 12}px`,
          };
          return (
            <div key={section.id} className="doc-pdf-section" style={style}>
              {lessonId && section.start_page && section.end_page ? (
                <button
                  type="button"
                  className={className}
                  disabled={locked}
                  title={section.excerpt || undefined}
                  onClick={() => {
                    if (locked) return;
                    onSectionSelect?.(section);
                    setSelectedSection(section);
                  }}
                >
                  {content}
                </button>
              ) : (
                <div className={className}>{content}</div>
              )}
            </div>
          );
        })}
      </nav>
      {lessonId && selectedSection && (
        <SectionLearningWindow
          key={selectedSection.id}
          lessonId={lessonId}
          section={selectedSection}
          nextSection={outline.flat[outline.flat.findIndex(item => item.id === selectedSection.id) + 1]}
          onSectionPassed={bestScore => {
            const index = outline.flat.findIndex(item => item.id === selectedSection.id);
            const nextSection = outline.flat[index + 1];
            setStatuses(current => ({
              ...current,
              [selectedSection.id]: {
                section_id: selectedSection.id,
                unlocked: true,
                completed: true,
                best_score: Math.max(current[selectedSection.id]?.best_score ?? 0, bestScore),
                attempts: (current[selectedSection.id]?.attempts ?? 0) + 1,
              },
              ...(nextSection ? {
                [nextSection.id]: {
                  section_id: nextSection.id,
                  unlocked: true,
                  completed: current[nextSection.id]?.completed ?? false,
                  best_score: current[nextSection.id]?.best_score ?? 0,
                  attempts: current[nextSection.id]?.attempts ?? 0,
                },
              } : {}),
            }));
          }}
          onClose={() => setSelectedSection(null)}
          onContinueNext={() => {
            const index = outline.flat.findIndex(item => item.id === selectedSection.id);
            const nextSection = outline.flat[index + 1];
            if (nextSection) {
              onSectionSelect?.(nextSection);
              setSelectedSection(nextSection);
            }
          }}
        />
      )}
    </>
  );
}
