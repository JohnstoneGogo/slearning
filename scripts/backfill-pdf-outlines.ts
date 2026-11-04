import { prisma } from '../src/server/db';
import { analyzePdfLesson } from '../src/server/pdf-analysis';

function batchLimit() {
  const raw = process.argv.find(arg => arg.startsWith('--limit='));
  if (!raw) return 5;
  const limit = Number(raw.slice('--limit='.length));
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new Error('--limit must be a positive integer.');
  }
  return limit;
}

function includeFailed() {
  return process.argv.includes('--include-failed');
}

async function main() {
  const limit = batchLimit();
  const retryFailed = includeFailed();
  const lessons = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id
    FROM "Lesson"
    WHERE kind = 'pdf'
      AND (
        ("outlineStatus" = 'pending' AND "outlineRequestedAt" IS NULL)
        OR (${retryFailed} AND "outlineStatus" = 'failed')
      )
      AND url LIKE 'private:%'
    ORDER BY id ASC
    LIMIT ${limit}
  `;

  let failures = 0;
  for (const lesson of lessons) {
    if (!await analyzePdfLesson(lesson.id)) failures++;
  }
  console.log(`Analyzed ${lessons.length - failures} of ${lessons.length} selected PDF lesson(s).`);
  if (failures) {
    console.error(`${failures} lesson(s) failed analysis; inspect the worker output and lesson status.`);
    process.exitCode = 1;
  }
}

main()
  .catch(error => {
    console.error('PDF outline backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
