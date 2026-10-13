import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const courses = await p.course.findMany({
  select: { title: true, coverUrl: true },
});
const cats = await p.category.findMany({
  select: { name: true, thumbUrl: true },
});
const facts = await p.fact.findMany({
  select: { title: true, imageUrl: true },
});

console.log("COURSES", JSON.stringify(courses, null, 0));
console.log("CATEGORIES", JSON.stringify(cats, null, 0));
console.log("FACTS", JSON.stringify(facts, null, 0));
console.log(
  "course covers set:",
  courses.filter((c) => c.coverUrl).length,
  "/",
  courses.length,
);
console.log(
  "category thumbs set:",
  cats.filter((c) => c.thumbUrl).length,
  "/",
  cats.length,
);
console.log(
  "fact images set:",
  facts.filter((f) => f.imageUrl).length,
  "/",
  facts.length,
);

await p.$disconnect();
