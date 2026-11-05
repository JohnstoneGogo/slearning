import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT migration_name, finished_at, rolled_back_at, checksum
    FROM _prisma_migrations
    WHERE migration_name IN (
      '20261013102752_add_course_payments',
      '20261013120000_add_quizzes_discussions_support',
      '20261104170000_add_section_progress',
      '20261104190000_add_section_quiz_progress'
    )
    ORDER BY migration_name
  `;
  console.log(JSON.stringify(rows, null, 2));
}

main().finally(() => prisma.$disconnect());
