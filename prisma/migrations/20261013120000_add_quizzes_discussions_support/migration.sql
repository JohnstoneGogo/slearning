-- CreateTable
CREATE TABLE "LessonResource" (
    "id" SERIAL NOT NULL,
    "lessonId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'pdf',
    "size" INTEGER,
    "sort" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "LessonResource_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Quiz" (
    "id" SERIAL NOT NULL,
    "lessonId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Lesson quiz',
    "passPercent" INTEGER NOT NULL DEFAULT 70,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" SERIAL NOT NULL,
    "quizId" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" JSONB NOT NULL DEFAULT '[]',
    "answerIndex" INTEGER NOT NULL DEFAULT 0,
    "explanation" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" SERIAL NOT NULL,
    "quizId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "percent" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "answers" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "DiscussionPost" (
    "id" SERIAL NOT NULL,
    "courseId" INTEGER NOT NULL,
    "lessonId" INTEGER,
    "userId" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'published',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiscussionPost_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "SupportRequest" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "status" TEXT NOT NULL DEFAULT 'open',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "LessonResource_lessonId_sort_idx" ON "LessonResource"("lessonId", "sort");
-- CreateIndex
CREATE UNIQUE INDEX "Quiz_lessonId_key" ON "Quiz"("lessonId");
-- CreateIndex
CREATE INDEX "Quiz_courseId_idx" ON "Quiz"("courseId");
-- CreateIndex
CREATE INDEX "QuizQuestion_quizId_sort_idx" ON "QuizQuestion"("quizId", "sort");
-- CreateIndex
CREATE INDEX "QuizAttempt_userId_quizId_idx" ON "QuizAttempt"("userId", "quizId");
-- CreateIndex
CREATE INDEX "DiscussionPost_courseId_createdAt_idx" ON "DiscussionPost"("courseId", "createdAt");
-- CreateIndex
CREATE INDEX "SupportRequest_status_createdAt_idx" ON "SupportRequest"("status", "createdAt");
-- AddForeignKey
ALTER TABLE "LessonResource"
ADD CONSTRAINT "LessonResource_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Quiz"
ADD CONSTRAINT "Quiz_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "QuizQuestion"
ADD CONSTRAINT "QuizQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "QuizAttempt"
ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "QuizAttempt"
ADD CONSTRAINT "QuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "DiscussionPost"
ADD CONSTRAINT "DiscussionPost_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "DiscussionPost"
ADD CONSTRAINT "DiscussionPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "SupportRequest"
ADD CONSTRAINT "SupportRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE
SET NULL ON UPDATE CASCADE;