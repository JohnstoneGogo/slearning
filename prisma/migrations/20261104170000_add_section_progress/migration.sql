CREATE TABLE "SectionProgress" (
    "userId" INTEGER NOT NULL,
    "lessonId" INTEGER NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SectionProgress_pkey" PRIMARY KEY ("userId", "lessonId", "sectionId")
);

CREATE INDEX "SectionProgress_lessonId_sectionId_idx"
ON "SectionProgress"("lessonId", "sectionId");

ALTER TABLE "SectionProgress"
ADD CONSTRAINT "SectionProgress_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SectionProgress"
ADD CONSTRAINT "SectionProgress_lessonId_fkey"
FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
