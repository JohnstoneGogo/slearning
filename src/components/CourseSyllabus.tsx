"use client";

import { useEffect, useState } from "react";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/components/Providers";
import { PdfOutlineView } from "@/components/PdfOutlineView";
import { readPdfOutline, type PdfOutlineData } from "@/lib/pdf-outline";

interface SyllabusLesson {
  id: number;
  title: string;
  kind: string;
  minutes: number;
  preview: boolean;
  outlineStatus: string;
  pdfOutline: PdfOutlineData | null;
}

interface LessonOutlineResponse {
  pdf_outline: unknown;
}

export default function CourseSyllabus({
  courseId,
  lessons,
}: {
  courseId: number;
  lessons: SyllabusLesson[];
}) {
  const { me, loading, toast } = useAuth();
  const [enrolled, setEnrolled] = useState(false);
  const [memberOutlines, setMemberOutlines] = useState<Record<number, PdfOutlineData>>({});

  useEffect(() => {
    let cancelled = false;
    setEnrolled(false);
    setMemberOutlines({});
    if (loading) return () => { cancelled = true; };
    if (!me) return () => { cancelled = true; };

    void api<{ enrolled: boolean }>(`/courses/${courseId}/me`)
      .then(async (access) => {
        if (cancelled) return;
        setEnrolled(access.enrolled);
        if (!access.enrolled) return;
        const paidPdfs = lessons.filter(
          (lesson) => lesson.kind === "pdf" && !lesson.preview && lesson.outlineStatus === "ready",
        );
        const responses = await Promise.all(
          paidPdfs.map(async (lesson) => {
            const result = await api<LessonOutlineResponse>(`/lessons/${lesson.id}/outline`);
            const outline = readPdfOutline(result.pdf_outline);
            return outline ? [lesson.id, outline] as const : null;
          }),
        );
        if (cancelled) return;
        setMemberOutlines(Object.fromEntries(responses.filter((row) => row !== null)));
      })
      .catch((error: unknown) => {
        if (!cancelled) toast(errMsg(error));
      });

    return () => { cancelled = true; };
  }, [courseId, lessons, loading, me, toast]);

  return (
    <div className="course-syllabus">
      {lessons.map((lesson, index) => {
        const isPdf = lesson.kind === "pdf";
        const memberOutline = memberOutlines[lesson.id];
        const outline = lesson.preview ? lesson.pdfOutline : memberOutline ?? lesson.pdfOutline;
        const ready = lesson.outlineStatus === "ready" && Boolean(outline?.flat.length);
        const hasDetails = !isPdf || lesson.outlineStatus === "pending" || ready;
        const minutes = ready && outline ? outline.total_minutes : lesson.minutes;
        const fullOutline = lesson.preview || enrolled;

        const summary = (
          <>
            <span className="course-lesson-num">{index + 1}</span>
            <span>{lesson.title}</span>
            <span className="course-lesson-meta">
              {lesson.preview && <span className="badge">Free preview</span>}
              <span className="muted" style={{ fontSize: ".85rem" }}>
                {({ text: "Reading", video: "Video", pdf: "PDF" } as Record<string, string>)[lesson.kind] || "Lesson"} · {minutes} min
              </span>
            </span>
          </>
        );

        if (!hasDetails) {
          return (
            <div key={lesson.id} className="course-lesson-detail course-lesson-static">
              {summary}
            </div>
          );
        }

        return (
          <details key={lesson.id} className="course-lesson-detail">
            <summary>{summary}</summary>
            {isPdf && lesson.outlineStatus === "pending" ? (
              <p className="course-lesson-content muted">Outline is being prepared.</p>
            ) : isPdf && ready && outline ? (
              <PdfOutlineView
                outline={outline}
                lessonId={fullOutline ? lesson.id : undefined}
                showPageRanges={fullOutline}
                showTotal={false}
              />
            ) : (
              <p className="course-lesson-content muted">Open the lesson to view its content.</p>
            )}
          </details>
        );
      })}
    </div>
  );
}
