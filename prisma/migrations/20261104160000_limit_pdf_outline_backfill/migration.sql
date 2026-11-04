ALTER TABLE "Lesson"
ALTER COLUMN "outlineRequestedAt" DROP NOT NULL;

UPDATE "Lesson"
SET "outlineRequestedAt" = NULL
WHERE "kind" = 'pdf' AND "outlineStatus" = 'pending';
