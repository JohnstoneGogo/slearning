ALTER TABLE "SectionProgress"
ADD COLUMN "lastPageViewed" INTEGER,
ADD COLUMN "bestScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "quizQuestionIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "quizAnswers" JSONB,
ALTER COLUMN "completedAt" DROP NOT NULL,
ALTER COLUMN "completedAt" DROP DEFAULT;

ALTER TABLE "QuizQuestion"
ALTER COLUMN "quizId" DROP NOT NULL,
ADD COLUMN "sectionLessonId" INTEGER,
ADD COLUMN "sectionId" INTEGER,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'approved';

ALTER TABLE "QuizQuestion"
ADD CONSTRAINT "QuizQuestion_sectionLessonId_fkey"
FOREIGN KEY ("sectionLessonId") REFERENCES "Lesson"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuizQuestion"
ADD CONSTRAINT "QuizQuestion_context_check"
CHECK (
  ("quizId" IS NOT NULL AND "sectionLessonId" IS NULL AND "sectionId" IS NULL)
  OR
  ("quizId" IS NULL AND "sectionLessonId" IS NOT NULL AND "sectionId" IS NOT NULL)
);

CREATE INDEX "QuizQuestion_sectionLessonId_sectionId_status_sort_idx"
ON "QuizQuestion"("sectionLessonId", "sectionId", "status", "sort");
