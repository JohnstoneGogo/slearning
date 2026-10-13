// Read models shared by the REST API and the server-rendered pages (one source of truth).
import type { Prisma } from '@prisma/client';
import { prisma } from './db';
import { CUR, PROD, cached, cfg, fail, signedPath } from './core';
import { provider } from './providers';

export const getConfig = () => cached('config', 60, async () => ({
  site: await cfg<Record<string, string>>('site'), reviews: await cfg<any[]>('reviews'), dev: !PROD && !provider().live,
  countries: await Promise.all(Object.keys(CUR).map(async c => ({ code: c, currency: CUR[c], activation_fee: (await cfg<Record<string, number>>('activation_fee'))[c] })))
}));
export const getFacts = () => cached('facts', 60, () => prisma.fact.findMany({ where: { active: true }, orderBy: { id: 'asc' } }));
export const getCategories = () => cached('cats', 60, async () =>
  (await prisma.category.findMany({ orderBy: [{ sort: 'asc' }, { id: 'asc' }], include: { _count: { select: { courses: { where: { published: true } } } } } })).map(({ _count, ...c }) => ({ ...c, count: _count.courses })));
export const getPage = async (slug: string) => { const p = await prisma.page.findUnique({ where: { slug } }); return p || fail(404, 'Page not found.'); };

export interface CourseQuery { category?: string; q?: string; level?: string; sort?: string; limit?: number; offset?: number; access?: string; certificate?: string; duration?: string; language?: string }
const sanitizeInt = (value: number | string | null | undefined, fallback: number, min: number, max?: number) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  if (i < min) return min;
  if (max !== undefined && i > max) return max;
  return i;
};
export const listCourses = (o: CourseQuery) => cached('courses:' + JSON.stringify(o), 60, async () => {
  const limit = sanitizeInt(o.limit, 24, 1, 60);
  const offset = sanitizeInt(o.offset, 0, 0);
  const categoryId = o.category && /^\d+$/.test(String(o.category)) ? Number(o.category) : undefined;
  const term = o.q?.trim();
  const duration: Prisma.CourseWhereInput = o.duration === 'short' ? { minutes: { lte: 60 } }
    : o.duration === 'medium' ? { minutes: { gt: 60, lte: 180 } }
      : o.duration === 'long' ? { minutes: { gt: 180 } } : {};
  const language = o.language?.trim().slice(0, 64);
  // "Free" courses offer at least one preview lesson; "Paid" courses require activation first.
  const access: Prisma.CourseWhereInput = o.access === 'free' ? { lessons: { some: { preview: true } } }
    : o.access === 'paid' ? { lessons: { none: { preview: true } } } : {};
  const where: Prisma.CourseWhereInput = {
    published: true, ...(categoryId !== undefined ? { categoryId } : {}), ...(o.level ? { level: o.level } : {}),
    ...(language ? { language } : {}), ...duration, ...access,
    ...(term ? { OR: ['title', 'author', 'description', 'skills'].map(f => ({ [f]: { contains: term, mode: 'insensitive' } })) as Prisma.CourseWhereInput[] } : {})
  };
  const orderBy: Prisma.CourseOrderByWithRelationInput[] = o.sort === 'rating' ? [{ rating: 'desc' }, { ratingCount: 'desc' }] : o.sort === 'popular' ? [{ enrolments: 'desc' }] : [{ id: 'desc' }];
  const [total, rows] = await Promise.all([
    prisma.course.count({ where }),
    prisma.course.findMany({ where, orderBy, take: limit, skip: offset, include: { category: { select: { name: true } }, _count: { select: { lessons: true, quizzes: true } }, lessons: { select: { preview: true } } } })
  ]);
  return { total, items: rows.map(({ category, _count, description, learnPoints, lessons, ...c }) => ({ ...c, description: description?.slice(0, 160) ?? null, category: category?.name ?? null, lessons: _count.lessons, has_free_preview: lessons.some(l => l.preview), quiz_count: _count.quizzes })) };
});
export const getCourseLanguages = () => cached('course_languages', 300, async () => {
  const rows = await prisma.course.findMany({
    where: { published: true },
    distinct: ['language'],
    select: { language: true },
    orderBy: { language: 'asc' },
  });
  return rows.map(row => row.language).filter(Boolean);
});
export const getCourse = async (id: number) => {
  const c = Number.isInteger(id) ? await prisma.course.findFirst({
    where: { id, published: true },
    include: {
      category: { select: { name: true } },
      lessons: { orderBy: [{ sort: 'asc' }, { id: 'asc' }], select: { id: true, title: true, kind: true, minutes: true, preview: true, quiz: { select: { id: true, passPercent: true, _count: { select: { questions: true } } } } } },
      _count: { select: { quizzes: true } },
    },
  }) : null;
  if (!c) return fail(404, 'Course not found.');
  const { category, learnPoints, skills, lessons, _count, ...rest } = c;
  return {
    ...rest, category: category?.name ?? null, learn_points: (learnPoints as string[]) || [], skills: skills.split(',').map(s => s.trim()).filter(Boolean),
    is_free: lessons.some(l => l.preview), quiz_count: _count.quizzes,
    lessons: lessons.map(({ quiz, ...l }) => ({ ...l, quiz: quiz ? { id: quiz.id, pass_percent: quiz.passPercent, questions: quiz._count.questions } : null })),
  };
};
export const getReviews = async (courseId: number) =>
  (await prisma.review.findMany({ where: { courseId, status: 'published' }, orderBy: { id: 'desc' }, take: 50, include: { user: { select: { fullName: true, country: true } } } }))
    .map(r => ({ rating: r.rating, body: r.body, createdAt: r.createdAt, name: r.user.fullName.split(' ')[0], country: r.user.country }));
export const getCertificate = async (code: string) => {
  const e = await prisma.enrollment.findUnique({ where: { certCode: code.toUpperCase() }, include: { user: { select: { fullName: true } }, course: { select: { title: true } } } });
  return e ? { completedAt: e.completedAt, certCode: e.certCode, fullName: e.user.fullName, title: e.course.title } : fail(404, 'Certificate not found.');
};
export async function rate(courseId: number) {
  const a = await prisma.review.aggregate({ where: { courseId, status: 'published' }, _avg: { rating: true }, _count: true });
  await prisma.course.update({ where: { id: courseId }, data: { rating: Math.round((a._avg.rating ?? 0) * 10) / 10, ratingCount: a._count } });
}

// ── Learning activity: streaks and achievements ──
// A learner's "active days" are the distinct calendar days on which they completed at least one lesson.
export interface LearningStats {
  current_streak: number; longest_streak: number; active_days: number;
  lessons_done: number; courses_completed: number; certificates: number;
  quiz_attempts: number; quiz_passed: number; average_score: number;
  achievements: Achievement[];
}
export interface Achievement { key: string; label: string; description: string; icon: string; earned: boolean; progress: number }

const DAY = 86_400_000;
const dayKey = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Pure helper so streaks can be unit-tested without a database. */
export function computeStreak(days: number[], today = dayKey(new Date())): { current: number; longest: number } {
  const uniq = [...new Set(days)].sort((a, b) => a - b);
  if (!uniq.length) return { current: 0, longest: 0 };
  let longest = 1, run = 1;
  for (let i = 1; i < uniq.length; i++) {
    const gap = Math.round((uniq[i] - uniq[i - 1]) / DAY);
    run = gap === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }
  // The current streak counts back from today (or yesterday, so a learner does not lose it before studying).
  const last = uniq[uniq.length - 1], fromToday = Math.round((today - last) / DAY);
  let current = 0;
  if (fromToday === 0 || fromToday === 1) {
    current = 1;
    for (let i = uniq.length - 1; i > 0; i--)
      if (Math.round((uniq[i] - uniq[i - 1]) / DAY) === 1) current++; else break;
  }
  return { current, longest: Math.max(longest, current) };
}

export async function getLearningStats(userId: number): Promise<LearningStats> {
  const [progress, completed, certs, attempts] = await Promise.all([
    prisma.lessonProgress.findMany({ where: { userId }, select: { doneAt: true } }),
    prisma.enrollment.count({ where: { userId, completedAt: { not: null } } }),
    prisma.enrollment.count({ where: { userId, certCode: { not: null } } }),
    prisma.quizAttempt.findMany({ where: { userId }, select: { percent: true, passed: true } }),
  ]);
  const days = progress.map(p => dayKey(p.doneAt));
  const { current, longest } = computeStreak(days);
  const quizPassed = attempts.filter(a => a.passed).length;
  const average = attempts.length ? Math.round(attempts.reduce((s, a) => s + a.percent, 0) / attempts.length) : 0;
  const lessonsDone = progress.length;
  const achievements: Achievement[] = [
    { key: 'first_lesson', label: 'First steps', description: 'Complete your first lesson', icon: '🌱', earned: lessonsDone >= 1, progress: Math.min(lessonsDone, 1) },
    { key: 'ten_lessons', label: 'Getting serious', description: 'Complete 10 lessons', icon: '📚', earned: lessonsDone >= 10, progress: Math.min(lessonsDone, 10) },
    { key: 'first_course', label: 'Course finisher', description: 'Complete your first course', icon: '🏁', earned: completed >= 1, progress: Math.min(completed, 1) },
    { key: 'three_courses', label: 'Skill collector', description: 'Complete 3 courses', icon: '🎯', earned: completed >= 3, progress: Math.min(completed, 3) },
    { key: 'first_certificate', label: 'Certified', description: 'Earn your first certificate', icon: '🎓', earned: certs >= 1, progress: Math.min(certs, 1) },
    { key: 'week_streak', label: 'Consistent', description: 'Study 7 days in a row', icon: '🔥', earned: longest >= 7, progress: Math.min(longest, 7) },
    { key: 'quiz_ace', label: 'Quiz ace', description: 'Pass 5 quizzes', icon: '✅', earned: quizPassed >= 5, progress: Math.min(quizPassed, 5) },
    { key: 'sharp_shooter', label: 'Sharp shooter', description: 'Average 90% or more across quizzes', icon: '🎖️', earned: attempts.length >= 3 && average >= 90, progress: average },
  ];
  return { current_streak: current, longest_streak: longest, active_days: new Set(days).size, lessons_done: lessonsDone, courses_completed: completed, certificates: certs, quiz_attempts: attempts.length, quiz_passed: quizPassed, average_score: average, achievements };
}

/** Learner-facing quiz shape: questions with options, but never the correct answer. */
export const getQuizForLesson = async (lessonId: number, userId: number) => {
  const q = await prisma.quiz.findUnique({
    where: { lessonId },
    include: { questions: { orderBy: [{ sort: 'asc' }, { id: 'asc' }] }, attempts: { where: { userId }, orderBy: { id: 'desc' }, take: 5 } },
  });
  if (!q) return null;
  const best = q.attempts.reduce((m, a) => Math.max(m, a.percent), 0);
  return {
    id: q.id, title: q.title, pass_percent: q.passPercent, total: q.questions.length,
    questions: q.questions.map(x => ({ id: x.id, prompt: x.prompt, options: (x.options as string[]) || [] })),
    passed: q.attempts.some(a => a.passed), best_percent: best,
    attempts: q.attempts.map(a => ({ percent: a.percent, passed: a.passed, createdAt: a.createdAt })),
  };
};

export const getDiscussion = async (courseId: number, lessonId?: number) =>
  (await prisma.discussionPost.findMany({
    where: { courseId, status: 'published', ...(lessonId ? { lessonId } : {}) },
    orderBy: { id: 'desc' }, take: 60,
    include: { user: { select: { fullName: true, country: true, avatarUrl: true } } },
  })).map(p => ({ id: p.id, lesson_id: p.lessonId, body: p.body, createdAt: p.createdAt, name: p.user.fullName, country: p.user.country, avatar_url: p.user.avatarUrl }));

export const getLessonResources = async (lessonId: number) =>
  (await prisma.lessonResource.findMany({ where: { lessonId }, orderBy: [{ sort: 'asc' }, { id: 'asc' }] }))
    .map(r => ({ id: r.id, title: r.title, kind: r.kind, size: r.size, url: r.url.startsWith('private:') ? signedPath(r.url.slice(8)) : r.url }));
