"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/components/Providers";
import type { PdfSection } from "@/lib/pdf-outline";

interface SectionQuizQuestion {
  id: number;
  prompt: string;
  options: string[];
}

interface SectionQuiz {
  questions: SectionQuizQuestion[];
  pass_percent: number;
  best_score: number;
  attempts: number;
  completed: boolean;
  question_index: number;
}

interface QuestionFeedback {
  question_id: number;
  selected_index: number;
  correct_index: number;
  correct: boolean;
  explanation: string | null;
}

interface QuizAttemptResult {
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  pass_percent: number;
  best_score: number;
  attempts: number;
  completed: boolean;
}

type Stage = "reader" | "quiz-start" | "question" | "feedback" | "result" | "complete";

export default function SectionLearningWindow({
  lessonId,
  section,
  nextSection,
  onClose,
  onContinueNext,
  onSectionPassed,
}: {
  lessonId: number;
  section: PdfSection;
  nextSection?: PdfSection;
  onClose: () => void;
  onContinueNext: () => void;
  onSectionPassed: (bestScore: number) => void;
}) {
  const { me } = useAuth();
  const [page, setPage] = useState(section.start_page ?? 0);
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [stage, setStage] = useState<Stage>("reader");
  const [quiz, setQuiz] = useState<SectionQuiz | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<QuestionFeedback | null>(null);
  const [attemptResult, setAttemptResult] = useState<QuizAttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const stageHeadingRef = useRef<HTMLHeadingElement>(null);
  const start = section.start_page ?? 0;
  const end = section.end_page ?? 0;
  const pageCount = Math.max(0, end - start + 1);
  const pageInSection = page - start + 1;
  const progress = pageCount ? Math.round((pageInSection / pageCount) * 100) : 0;
  const atEnd = page >= end;
  const currentQuestion = quiz?.questions[questionIndex];

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  useEffect(() => {
    if (stage !== "reader") stageHeadingRef.current?.focus();
  }, [stage]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "Tab") {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusable = [...dialog.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])',
        )].filter(element => element.getClientRects().length > 0);
        if (!focusable.length) {
          event.preventDefault();
          dialog.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      if (stage !== "reader") return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setPage(current => Math.max(start, current - 1));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setPage(current => Math.min(end, current + 1));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [end, onClose, stage, start]);

  useEffect(() => {
    if (start < 1 || end < start || page < start || page > end) {
      setLoading(false);
      setError("This section does not have a valid page range.");
      return;
    }

    const controller = new AbortController();
    let objectUrl = "";
    setLoading(true);
    setError("");
    setImageUrl("");
    fetch(`/api/v1/lessons/${lessonId}/sections/${section.id}/pages/${page}`, {
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async response => {
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error || "This page could not be loaded.");
        }
        if (!response.headers.get("content-type")?.startsWith("image/png")) {
          throw new Error("The page preview returned an unsupported image.");
        }
        return response.blob();
      })
      .then(blob => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setLoading(false);
        setError(errMsg(cause));
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [end, lessonId, page, retry, section.id, start]);

  const beginQuiz = useCallback(async () => {
    if (!me) return;
    setQuizLoading(true);
    setQuizError("");
    try {
      const loaded = await api<SectionQuiz>(`/lessons/${lessonId}/sections/${section.id}/quiz`);
      setQuiz(loaded);
      setQuestionIndex(loaded.question_index);
      setSelectedAnswer(null);
      setFeedback(null);
      setAttemptResult(null);
      setStage(loaded.completed ? "complete" : loaded.question_index > 0 ? "question" : "quiz-start");
    } catch (cause) {
      setQuizError(errMsg(cause));
    } finally {
      setQuizLoading(false);
    }
  }, [lessonId, me, section.id]);

  const submitAnswer = async () => {
    if (!currentQuestion || selectedAnswer === null || !quiz) return;
    setSubmitting(true);
    setQuizError("");
    try {
      const response = await api<{
        feedback: QuestionFeedback;
        score?: number;
        total?: number;
        percent?: number;
        passed?: boolean;
        pass_percent?: number;
        best_score?: number;
        attempts?: number;
        completed?: boolean;
      }>(`/lessons/${lessonId}/sections/${section.id}/quiz/answer`, {
        body: {
          question_id: currentQuestion.id,
          answer_index: selectedAnswer,
        },
      });
      setFeedback(response.feedback);
      setSelectedAnswer(null);
      if (finish) {
        const result = {
          score: response.score ?? 0,
          total: response.total ?? quiz.questions.length,
          percent: response.percent ?? 0,
          passed: response.passed ?? false,
          pass_percent: response.pass_percent ?? quiz.pass_percent,
          best_score: response.best_score ?? quiz.best_score,
          attempts: response.attempts ?? quiz.attempts + 1,
          completed: response.completed ?? false,
        };
        setAttemptResult(result);
        setQuiz(current => current ? {
          ...current,
          best_score: result.best_score,
          attempts: result.attempts,
          completed: result.completed,
        } : current);
        if (result.passed) onSectionPassed(result.best_score);
      }
      setStage("feedback");
    } catch (cause) {
      setQuizError(errMsg(cause));
    } finally {
      setSubmitting(false);
    }
  };

  const continueQuiz = () => {
    if (!quiz) return;
    if (questionIndex + 1 < quiz.questions.length) {
      setQuestionIndex(current => current + 1);
      setSelectedAnswer(null);
      setFeedback(null);
      setStage("question");
      return;
    }
    setStage(attemptResult?.passed ? "complete" : "result");
  };

  const retryQuiz = () => {
    setQuestionIndex(0);
    setSelectedAnswer(null);
    setFeedback(null);
    setAttemptResult(null);
    setQuizError("");
    setStage("question");
  };

  return (
    <div
      className="section-window-backdrop"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="section-window"
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="section-window-title"
        aria-describedby="section-window-description"
      >
        <header className="section-window-head">
          <div className="section-window-brand" aria-label="Slearning">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3.5 5.2c3.2-.8 5.9-.3 8.5 1.5v13c-2.6-1.8-5.3-2.3-8.5-1.5zM20.5 5.2c-3.2-.8-5.9-.3-8.5 1.5v13c2.6-1.8 5.3-2.3 8.5-1.5z" />
            </svg>
            <span>Slearning</span>
          </div>
          <div className="section-window-heading">
            <h2 id="section-window-title">{section.title}</h2>
            <p id="section-window-description">
              {section.minutes} min study time <span aria-hidden="true">·</span> {section.category.label}
            </p>
          </div>
          <div className="section-window-page-count" aria-live="polite">
            {stage === "reader" ? <>Page <strong>{pageInSection}</strong> of {pageCount}</> : "Knowledge check"}
          </div>
          <button type="button" className="section-window-close" onClick={onClose} aria-label="Close reader">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div
          className="section-window-progress"
          role="progressbar"
          aria-label="Section reading progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={stage === "reader" ? progress : 100}
        >
          <span style={{ width: `${stage === "reader" ? progress : 100}%` }} />
        </div>

        {stage === "reader" ? (
          <>
            <main className="section-window-main">
              <div className="section-window-page" aria-live="polite" aria-busy={loading}>
                {loading && (
                  <div className="section-window-state">
                    <span className="section-window-spinner" aria-hidden="true" />
                    <p>Loading this page…</p>
                  </div>
                )}
                {error && (
                  <div className="section-window-state section-window-error" role="alert">
                    <p>{error}</p>
                    <button type="button" className="btn sm" onClick={() => setRetry(value => value + 1)}>
                      Retry page
                    </button>
                  </div>
                )}
                {imageUrl && <img src={imageUrl} alt={`Page ${page} of ${section.title}`} />}
              </div>
              <aside className="section-window-aside" aria-label="Section details">
                <h3>About this section</h3>
                <dl>
                  <div><dt>Estimated study time</dt><dd>{section.minutes} min</dd></div>
                  <div><dt>Pages in section</dt><dd>{pageCount}</dd></div>
                </dl>
                <div className="section-window-tip">
                  <strong>Study tip</strong>
                  <p>{section.excerpt || "Take your time and focus on the key ideas on each page."}</p>
                </div>
                <div className="section-window-next">
                  <span>Up next</span>
                  <strong>Knowledge check</strong>
                  <small>Pass with {quiz?.pass_percent ?? 70}% to complete this section</small>
                </div>
              </aside>
            </main>
            <footer className="section-window-controls">
              <button
                type="button"
                className="btn"
                disabled={page <= start || loading}
                onClick={() => setPage(current => current - 1)}
              >
                <span aria-hidden="true">←</span> Previous
              </button>
              {atEnd ? (
                me ? (
                  <button
                    type="button"
                    className="btn primary"
                    disabled={loading || Boolean(error) || quizLoading}
                    onClick={() => void beginQuiz()}
                  >
                    {quizLoading ? "Loading quiz…" : "Check your understanding"}
                  </button>
                ) : (
                  <Link className="btn primary" href="/login">Log in to take the quiz</Link>
                )
              ) : (
                <button
                  type="button"
                  className="btn primary"
                  disabled={loading || Boolean(error)}
                  onClick={() => setPage(current => current + 1)}
                >
                  Next <span aria-hidden="true">→</span>
                </button>
              )}
            </footer>
            {(quizError || (atEnd && !me)) && (
              <p className="section-window-login-note" role={quizError ? "alert" : undefined}>
                {quizError || "Log in to take the knowledge check and save your completion."}
              </p>
            )}
          </>
        ) : stage === "quiz-start" ? (
          <main className="section-window-quiz-state">
            <p className="section-window-eyebrow">Check your understanding</p>
            <h3 ref={stageHeadingRef} tabIndex={-1}>Ready for the knowledge check?</h3>
            <p>Answer {quiz?.questions.length} questions. You need {quiz?.pass_percent}% to pass. You can retry if needed.</p>
            {quiz && quiz.attempts > 0 && (
              <p className="section-window-quiz-record">
                Best score: <strong>{quiz.best_score}%</strong> · Attempts: {quiz.attempts}
              </p>
            )}
            {quizError && <p className="section-window-quiz-error" role="alert">{quizError}</p>}
            <div className="section-window-finish-actions">
              <button type="button" className="btn primary" disabled={!quiz} onClick={() => setStage("question")}>
                Start quiz
              </button>
              <button type="button" className="btn" onClick={() => setStage("reader")}>Back to reading</button>
            </div>
          </main>
        ) : stage === "question" && currentQuestion ? (
          <main className="section-window-quiz">
            <div className="section-window-quiz-heading">
              <p className="section-window-eyebrow">Question {questionIndex + 1} of {quiz?.questions.length}</p>
              <h3 ref={stageHeadingRef} tabIndex={-1}>{currentQuestion.prompt}</h3>
            </div>
            <fieldset className="section-window-options">
              <legend className="sr-only">Choose one answer</legend>
              {currentQuestion.options.map((option, index) => (
                <label key={index} className={selectedAnswer === index ? "selected" : ""}>
                  <input
                    type="radio"
                    name={`section-question-${currentQuestion.id}`}
                    value={index}
                    checked={selectedAnswer === index}
                    onChange={() => setSelectedAnswer(index)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </fieldset>
            {quizError && <p className="section-window-quiz-error" role="alert">{quizError}</p>}
            <footer className="section-window-quiz-actions">
              <span>{quiz?.pass_percent}% required to pass</span>
              <button type="button" className="btn primary" disabled={selectedAnswer === null || submitting} onClick={() => void submitAnswer()}>
                {submitting ? "Checking…" : "Submit answer"}
              </button>
            </footer>
          </main>
        ) : stage === "feedback" && feedback && currentQuestion ? (
          <main className="section-window-quiz-state">
            <p className={`section-window-feedback-mark ${feedback.correct ? "correct" : "incorrect"}`}>
              {feedback.correct ? "Correct" : "Not quite"}
            </p>
            <h3 ref={stageHeadingRef} tabIndex={-1}>{currentQuestion.prompt}</h3>
            <p className="section-window-correct-answer">
              Correct answer: <strong>{currentQuestion.options[feedback.correct_index]}</strong>
            </p>
            {feedback.explanation && <p className="section-window-explanation">{feedback.explanation}</p>}
            {attemptResult && (
              <p className="section-window-quiz-record" role="status">
                Score: <strong>{attemptResult.percent}%</strong> · Best: <strong>{attemptResult.best_score}%</strong>
              </p>
            )}
            <div className="section-window-finish-actions">
              <button type="button" className="btn primary" onClick={continueQuiz}>
                {questionIndex + 1 < (quiz?.questions.length ?? 0) ? "Next question" : attemptResult?.passed ? "View completion" : "View results"}
              </button>
            </div>
          </main>
        ) : stage === "result" && attemptResult ? (
          <main className="section-window-quiz-state">
            <p className="section-window-eyebrow">Quiz attempt complete</p>
            <h3 ref={stageHeadingRef} tabIndex={-1}>You scored {attemptResult.percent}%</h3>
            <p>You need {attemptResult.pass_percent}% to pass. Your best score is {attemptResult.best_score}%.</p>
            <p className="section-window-quiz-record">Attempts: {attemptResult.attempts}</p>
            <div className="section-window-finish-actions">
              <button type="button" className="btn primary" onClick={retryQuiz}>Retry quiz</button>
              <button type="button" className="btn" onClick={() => setStage("reader")}>Review the section</button>
            </div>
          </main>
        ) : stage === "complete" ? (
          <main className="section-window-finish" role="status">
            <div className="section-window-finish-mark" aria-hidden="true">✓</div>
            <p className="section-window-eyebrow">Section complete</p>
            <h3 ref={stageHeadingRef} tabIndex={-1}>{section.title}</h3>
            <p className="section-window-finish-copy">
              You passed the knowledge check. Your section progress has been saved.
            </p>
            <div className="section-window-finish-meta">
              <span><strong>{attemptResult?.percent ?? quiz?.best_score ?? 0}%</strong> latest score</span>
              <span><strong>{quiz?.best_score ?? attemptResult?.best_score ?? 0}%</strong> best score</span>
              <span><strong>{quiz?.attempts ?? attemptResult?.attempts ?? 0}</strong> attempts</span>
            </div>
            <div className="section-window-finish-actions">
              {nextSection ? (
                <button type="button" className="btn primary" onClick={onContinueNext}>
                  Continue to next section <span aria-hidden="true">→</span>
                </button>
              ) : (
                <button type="button" className="btn primary" onClick={onClose}>Back to lesson outline</button>
              )}
              <button type="button" className="btn" onClick={() => {
                setAttemptResult(null);
                setStage("quiz-start");
              }}>Retake quiz</button>
            </div>
          </main>
        ) : null}
      </section>
    </div>
  );
}
