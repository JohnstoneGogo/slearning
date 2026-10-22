import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { Prisma, User } from '@prisma/client';
import { prisma } from '../db';
import { CUR, APP_URL, audit, balances, cfg, clearCache, entry, fail, limit, lockUser, makeToken, notify, secret, signedPath, useToken } from '../core';
import { cookieHeader, signToken, userFrom } from '../auth';
import { mail } from '../mail';
import { member, pub, Res } from '../router';
import { isLessonInPublishedCourse } from '../lesson-access';
import { canAccessCourse } from '../course-access';
import { createPrivateFileUrl, uploadPublicFile } from '../storage';
import * as data from '../data';
import '../payments';

const BCRYPT_ROUNDS = 12;

// Dummy hash used to ensure bcrypt always runs on login (prevents timing-based user enumeration)
const DUMMY_HASH = '$2a$12$dummy.hash.that.never.matches.any.real.password.xxxxxx';

const sendVerify = async (u: User) =>
  mail(u.email, 'Verify your email',
    `Hi ${u.fullName.split(' ')[0]},\n\nConfirm your email address:\n${APP_URL}/verify?token=${await makeToken(u.id, 'verify', 60 * 24)}\n\nThis link expires in 24 hours.`);

export const present = async (u: User) => {
  const { passwordHash, ...r } = u;
  return { ...r, currency: CUR[u.country], balances: await balances(prisma, u.id) };
};

const session = async (u: User, status = 200) => {
  const token = await signToken(u.id, u.tokenVersion);
  return new Res({ token, user: await present(u) }, status, { 'Set-Cookie': cookieHeader(token) });
};

/** Check magic bytes to verify actual file type, not just the declared Content-Type. */
function checkImageMagic(buf: Buffer): void {
  // PNG: 89 50 4E 47 | JPEG: FF D8 FF | WebP: 52 49 46 46 ... 57 45 42 50 | GIF: 47 49 46 38
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isWebp = buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
  const isGif = buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38;
  if (!isPng && !isJpeg && !isWebp && !isGif) fail(400, 'File content does not match an allowed image type (PNG, JPG, WebP, GIF).');
}

function checkPdfMagic(buf: Buffer): void {
  // PDF: 25 50 44 46 (%PDF)
  if (buf[0] !== 0x25 || buf[1] !== 0x50 || buf[2] !== 0x44 || buf[3] !== 0x46)
    fail(400, 'File content does not appear to be a valid PDF.');
}

// ---------- public content ----------
pub('GET', '/public/config', async () => data.getConfig(), 60);
pub('GET', '/public/facts', async () => data.getFacts(), 60);
pub('GET', '/pages/:slug', async c => data.getPage(c.params.slug), 300);
pub('GET', '/categories', async () => data.getCategories(), 60);
const intParam = (value: string | null, fallback: number, min: number, max?: number) => {
  const n = Number(value ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  if (i < min) return min;
  if (max !== undefined && i > max) return max;
  return i;
};

pub('GET', '/courses', async ({ query: q }) => data.listCourses({
  category: q.get('category') && /^\d+$/.test(q.get('category')!) ? q.get('category')! : undefined,
  q: q.get('q') || undefined,
  level: q.get('level') || undefined,
  sort: q.get('sort') || undefined,
  access: q.get('access') === 'free' || q.get('access') === 'paid' ? q.get('access')! : undefined,
  certificate: q.get('certificate') || undefined,
  duration: ['short', 'medium', 'long'].includes(q.get('duration') || '') ? q.get('duration')! : undefined,
  language: q.get('language')?.trim().slice(0, 64) || undefined,
  limit: intParam(q.get('limit'), 24, 1, 60),
  offset: intParam(q.get('offset'), 0, 0),
}), 60);
pub('GET', '/search', async ({ query }) => {
  const t = (query.get('q') || '').trim();
  return t.length < 2 ? [] : prisma.course.findMany({
    where: { published: true, title: { contains: t, mode: 'insensitive' } },
    orderBy: { enrolments: 'desc' }, take: 6, select: { id: true, title: true },
  });
});
pub('GET', '/courses/:id', async c => data.getCourse(+c.params.id), 60);
pub('GET', '/courses/:id/reviews', async c => data.getReviews(+c.params.id), 30);
pub('GET', '/certificates/:code', async c => {
  await limit('cert:' + c.ip, 20, 60e3); // L-08: rate limit certificate lookups
  return data.getCertificate(c.params.code);
});

// ---------- auth ----------
const RegisterSchema = z.object({
  username: z.string().regex(/^[a-z0-9_]{3,20}$/i, 'Username must be 3-20 letters, numbers or underscores.').transform(s => s.toLowerCase()),
  full_name: z.string().min(3, 'Enter your full name.').max(100),
  email: z.string().email('Enter a valid email address.').toLowerCase(),
  country: z.enum(['GH', 'NG'], { message: 'Choose Ghana or Nigeria.' }),
  phone: z.string().regex(/^\+?\d{8,15}$/, 'Enter a valid WhatsApp number with country code.'),
  password: z.string().regex(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/, 'Password needs 8+ characters with a letter and a number.'),
  confirm_password: z.string(),
  referrer_id: z.string().optional(),
}).refine(d => d.password === d.confirm_password, { message: 'Passwords do not match.', path: ['confirm_password'] });

pub('POST', '/auth/register', async c => {
  await limit('reg:' + c.ip, 10, 3600e3);
  const parsed = RegisterSchema.safeParse(await c.json());
  if (!parsed.success) fail(400, parsed.error.issues[0].message);
  const b = parsed.data!;
  let referrerId: number | null = null;
  if (b.referrer_id) {
    const r = await prisma.user.findFirst({ where: { memberId: { equals: b.referrer_id.trim(), mode: 'insensitive' } } });
    if (!r) fail(400, 'That referrer ID was not found.');
    referrerId = r!.id;
  }
  if (await prisma.user.findFirst({ where: { OR: [{ username: b.username }, { email: b.email }] } }))
    fail(400, 'That username or email is already registered.');
  let memberId: string;
  do { memberId = 'SL' + crypto.randomInt(1e6, 1e7); } while (await prisma.user.findUnique({ where: { memberId } }));
  const u = await prisma.user.create({
    data: {
      memberId, username: b.username, email: b.email, fullName: b.full_name.trim(),
      country: b.country, phone: b.phone, referrerId,
      passwordHash: await bcrypt.hash(b.password, BCRYPT_ROUNDS),
      deadlineAt: new Date(Date.now() + (await cfg<number>('task_deadline_hours')) * 3600e3),
    },
  });
  await notify(prisma, u.id, 'Welcome', 'Your account is created. Verify your email, then activate your account.', '/activate');
  void sendVerify(u).catch(e => console.error(JSON.stringify({ level: 'error', msg: 'sendVerify failed', ts: new Date().toISOString() })));
  return session(u, 201);
});

pub('POST', '/auth/login', async c => {
  const raw = await c.json() as Record<string, unknown>;
  const id = String(raw.identifier || '').trim().toLowerCase();
  await limit('login:' + c.ip + ':' + id, 8, 15 * 60e3);
  const u = await prisma.user.findFirst({ where: { OR: [{ username: id }, { email: id }] } });
  const hashToCheck = u?.passwordHash ?? DUMMY_HASH;
  const valid = await bcrypt.compare(String(raw.password || ''), hashToCheck);
  if (!u || !valid) fail(401, 'The username/email or password is incorrect.');
  if (u!.suspended) fail(403, 'This account is suspended. Contact support.');
  if (u!.role === 'admin') await audit(u!.id, 'admin_login', { ip: c.ip, ua: c.req.headers.get('user-agent')?.slice(0, 120) });
  return session(u!);
});

pub('POST', '/auth/logout', async () => new Res({ ok: true }, 200, { 'Set-Cookie': cookieHeader(null) }));

pub('POST', '/auth/verify', async c => {
  const id = await useToken((await c.json() as Record<string, unknown>).token, 'verify');
  await prisma.user.update({ where: { id }, data: { emailVerified: true } });
  await notify(prisma, id, 'Email verified', 'Thanks. Your email address is confirmed.', '/dashboard');
  return { ok: true };
});

member('POST', '/auth/resend', async ({ user }) => {
  await limit('rs:' + user.id, 3, 3600e3);
  if (!user.emailVerified) await sendVerify(user);
  return { ok: true };
});

pub('POST', '/auth/forgot', async c => {
  await limit('fg:' + c.ip, 5, 3600e3);
  const u = await prisma.user.findUnique({ where: { email: String((await c.json() as Record<string, unknown>).email || '').trim().toLowerCase() } });
  if (u && !u.suspended)
    await mail(u.email, 'Reset your password',
      `Reset your password here:\n${APP_URL}/reset?token=${await makeToken(u.id, 'reset', 60)}\n\nThe link expires in 1 hour. If you did not ask for this, ignore this email.`);
  return { ok: true, message: 'If that email is registered, a reset link is on its way.' };
});

pub('POST', '/auth/reset', async c => {
  const raw = await c.json() as Record<string, unknown>;
  if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(String(raw.password || ''))) fail(400, 'Password needs 8+ characters with a letter and a number.');
  const userId = await useToken(raw.token, 'reset');
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(String(raw.password), BCRYPT_ROUNDS), tokenVersion: { increment: 1 } } });
  return { ok: true };
});

// ---------- member ----------
member('GET', '/me', async ({ user }) => present(user));

const PatchMeSchema = z.object({
  full_name: z.string().min(3).max(100).optional(),
  phone: z.string().regex(/^\+?\d{8,15}$/, 'Enter a valid phone number.').optional(),
  avatar_url: z.string().url().max(500).nullable().optional(),
});

member('PATCH', '/me', async ({ user, json }) => {
  const parsed = PatchMeSchema.safeParse(await json());
  if (!parsed.success) fail(400, parsed.error.issues[0].message);
  const b = parsed.data!;
  const upd: Record<string, unknown> = {};
  if (b.full_name) upd.fullName = b.full_name.trim();
  if (b.phone) upd.phone = b.phone.replace(/[\s-]/g, '');
  if (b.avatar_url !== undefined) upd.avatarUrl = b.avatar_url || null;
  if (Object.keys(upd).length) await prisma.user.update({ where: { id: user.id }, data: upd });
  return present(await prisma.user.findUniqueOrThrow({ where: { id: user.id } }));
});

member('POST', '/me/avatar', async ({ user, req }) => {
  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length || buf.length > 5e6) fail(400, 'No file received (max 5 MB).');
  checkImageMagic(buf); // M-08: verify by magic bytes, not Content-Type
  const sharp = (await import('sharp')).default;
  const id = (await import('node:crypto')).randomBytes(12).toString('hex');
  const avatar = await sharp(buf).rotate().resize(200, 200, { fit: 'cover' }).webp({ quality: 85 }).toBuffer();
  const avatarUrl = await uploadPublicFile(id + '-av.webp', avatar);
  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl } });
  return { url: avatarUrl };
});

member('POST', '/me/password', async ({ user, json }) => {
  const raw = await json() as Record<string, unknown>;
  if (!await bcrypt.compare(String(raw.current || ''), user.passwordHash)) fail(400, 'Current password is incorrect.');
  if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(String(raw.password || ''))) fail(400, 'Password needs 8+ characters with a letter and a number.');
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(String(raw.password), BCRYPT_ROUNDS), tokenVersion: { increment: 1 } } });
  return { ok: true };
});

member('GET', '/me/notifications', async ({ user }) =>
  prisma.notification.findMany({ where: { userId: user.id }, orderBy: { id: 'desc' }, take: 50 }));

member('POST', '/me/notifications/read', async ({ user }) => {
  await prisma.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
  return { ok: true };
});

member('GET', '/me/referrals', async ({ user }) => ({
  member_id: user.memberId,
  referrer: user.referrerId ? (await prisma.user.findUnique({ where: { id: user.referrerId } }))?.memberId ?? null : null,
  count: await prisma.user.count({ where: { referrerId: user.id } }),
}));

member('POST', '/me/activate', async ({ user }) => {
  const reward = await cfg<Record<string, number>>('referral_reward');
  await prisma.$transaction(async tx => {
    await lockUser(tx, user.id);
    const u = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
    if (u.status === 'activated') fail(409, 'Your account is already active.');
    const p = await tx.payment.findFirst({ where: { userId: u.id, kind: 'activation', status: 'success', consumed: false }, orderBy: { id: 'desc' } });
    if (!p) fail(402, 'We could not find a verified payment for this account.');
    if (!(await tx.payment.updateMany({ where: { id: p!.id, consumed: false }, data: { consumed: true } })).count)
      fail(409, 'This payment was already used.');
    await tx.user.update({ where: { id: u.id }, data: { status: 'activated', eligible: true } });
    const r = u.referrerId ? await tx.user.findFirst({ where: { id: u.referrerId, eligible: true } }) : null;
    if (r) {
      // H-03: record referral for admin review; reward goes to pending
      await entry(tx, r.id, 'pending', reward[r.country], 'reward', 'REF-' + u.id);
      await notify(tx, r.id, 'Referral reward pending', 'A member you referred activated. Your reward is pending validation.', '/earnings');
      await audit(null, 'referral_reward_pending', { referrer: r.id, referred: u.id, ip: 'see_registration_audit' });
    }
    await notify(tx, u.id, 'Account activated', 'Welcome aboard. All member features are unlocked.', '/dashboard');
  });
  await audit(user.id, 'activate');
  return present(await prisma.user.findUniqueOrThrow({ where: { id: user.id } }));
});

// ---------- learning ----------
async function percents(userId: number, courseIds: number[]) {
  const [totals, done] = await Promise.all([
    prisma.lesson.groupBy({ by: ['courseId'], where: { courseId: { in: courseIds } }, _count: true }),
    prisma.lessonProgress.groupBy({ by: ['courseId'], where: { userId, courseId: { in: courseIds } }, _count: true }),
  ]);
  const t = new Map(totals.map(x => [x.courseId, x._count]));
  const d = new Map(done.map(x => [x.courseId, x._count]));
  return (id: number) => Math.floor(((d.get(id) || 0) * 100) / Math.max(t.get(id) || 0, 1));
}

const enrol = async (tx: Prisma.TransactionClient | typeof prisma, userId: number, courseId: number) => {
  if ((await tx.enrollment.createMany({ data: [{ userId, courseId }], skipDuplicates: true })).count)
    await tx.course.update({ where: { id: courseId }, data: { enrolments: { increment: 1 } } });
};

member('GET', '/me/courses', async ({ user }) => {
  const rows = await prisma.enrollment.findMany({ where: { userId: user.id }, include: { course: true }, orderBy: { createdAt: 'desc' } });
  const pc = await percents(user.id, rows.map(r => r.courseId));
  return rows.sort((a, b) => +!!a.completedAt - +!!b.completedAt).map(({ course: c, completedAt, certCode }) => ({
    id: c.id, title: c.title, author: c.author, coverUrl: c.coverUrl, minutes: c.minutes, level: c.level,
    rating: c.rating, ratingCount: c.ratingCount, rewardEligible: c.rewardEligible, completedAt, certCode, percent: pc(c.id),
  }));
});

member('GET', '/me/bookmarks', async ({ user }) =>
  (await prisma.bookmark.findMany({ where: { userId: user.id }, include: { course: true } })).map(b => b.course));

member('GET', '/courses/:id/me', async ({ user, params }) => {
  const id = +params.id;
  const [course, e] = await Promise.all([
    prisma.course.findFirst({ where: { id, published: true }, select: { priceGhs: true, priceNgn: true } }),
    prisma.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: id } } }),
  ]);
  if (!course) return fail(404, 'Course not found.');
  const price = user.country === 'GH' ? course.priceGhs : course.priceNgn;
  const [pc, pending] = await Promise.all([
    percents(user.id, [id]),
    prisma.payment.findFirst({ where: { userId: user.id, kind: 'course', courseId: id, status: 'pending' }, orderBy: { id: 'desc' }, select: { reference: true } }),
  ]);
  return {
    enrolled: !!e, percent: e ? pc(id) : 0, completed: !!e?.completedAt, cert_code: e?.certCode ?? null,
    has_access: canAccessCourse({ activated: user.status === 'activated', preview: false, price, paidAt: e?.paidAt ?? null }),
    price, currency: CUR[user.country], pending_payment: pending?.reference ?? null,
    done: (await prisma.lessonProgress.findMany({ where: { userId: user.id, courseId: id }, select: { lessonId: true } })).map(r => r.lessonId),
    bookmarked: !!(await prisma.bookmark.findUnique({ where: { userId_courseId: { userId: user.id, courseId: id } } })),
  };
});

member('POST', '/courses/:id/enroll', async ({ user, params }) => {
  const id = +params.id;
  const course = await prisma.course.findFirst({ where: { id, published: true }, select: { priceGhs: true, priceNgn: true } });
  if (!course) return fail(404, 'Course not found.');
  const enrollment = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: id } } });
  const price = user.country === 'GH' ? course.priceGhs : course.priceNgn;
  if (!canAccessCourse({ activated: user.status === 'activated', preview: false, price, paidAt: enrollment?.paidAt ?? null }))
    fail(402, 'Purchase this course to enroll.');
  await enrol(prisma, user.id, +params.id);
  return { ok: true };
});

member('POST', '/courses/:id/bookmark', async ({ user, params }) => {
  const k = { userId_courseId: { userId: user.id, courseId: +params.id } };
  if (await prisma.bookmark.findUnique({ where: k })) { await prisma.bookmark.delete({ where: k }); return { bookmarked: false }; }
  await prisma.bookmark.create({ data: { userId: user.id, courseId: +params.id } });
  return { bookmarked: true };
});

member('GET', '/lessons/:id', async ({ user, params }) => {
  const lesson = await prisma.lesson.findUnique({
    where: { id: +params.id },
    include: { course: { select: { published: true, priceGhs: true, priceNgn: true } } },
  }) ?? fail(404, 'Lesson not found.');
  if (!isLessonInPublishedCourse(lesson)) fail(404, 'Lesson not found.');
  const enrollment = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: lesson.courseId } } });
  const price = user.country === 'GH' ? lesson.course.priceGhs : lesson.course.priceNgn;
  if (!canAccessCourse({ activated: user.status === 'activated', preview: lesson.preview, price, paidAt: enrollment?.paidAt ?? null }))
    fail(402, price == null ? 'Activate your account or contact support to access this course.' : 'Purchase this course to open this lesson.');
  await enrol(prisma, user.id, lesson.courseId);
  const { course: _course, ...l } = lesson;
  const [resources, quiz] = await Promise.all([
    data.getLessonResources(l.id),
    data.getQuizForLesson(l.id, user.id),
  ]);
  return { ...l, url: l.url?.startsWith('private:') ? signedPath(l.url.slice(8)) : l.url, resources, quiz };
});

// ── Quizzes ──
member('POST', '/quizzes/:id/attempt', async ({ user, params, json }) => {
  const quiz = await prisma.quiz.findUnique({
    where: { id: +params.id },
    include: { questions: { orderBy: [{ sort: 'asc' }, { id: 'asc' }] }, lesson: { select: { courseId: true, preview: true } } },
  }) ?? fail(404, 'Quiz not found.');
  if (!quiz.questions.length) fail(400, 'This quiz has no questions yet.');
  const course = await prisma.course.findFirst({ where: { id: quiz.lesson.courseId, published: true }, select: { priceGhs: true, priceNgn: true } });
  if (!course) return fail(404, 'Quiz not found.');
  const enrollment = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: quiz.lesson.courseId } } });
  const price = user.country === 'GH' ? course.priceGhs : course.priceNgn;
  if (!canAccessCourse({ activated: user.status === 'activated', preview: quiz.lesson.preview, price, paidAt: enrollment?.paidAt ?? null }))
    fail(402, price == null ? 'Activate your account or contact support to take this quiz.' : 'Purchase this course to take this quiz.');
  const raw = await json() as Record<string, unknown>;
  const chosen = Array.isArray(raw.answers) ? raw.answers : [];
  let score = 0;
  const graded = quiz.questions.map((q, i) => {
    const picked = Math.trunc(Number(chosen[i]));
    const ok = picked === q.answerIndex;
    if (ok) score++;
    return { question_id: q.id, picked: Number.isInteger(picked) ? picked : null, correct: q.answerIndex, ok, explanation: q.explanation };
  });
  const total = quiz.questions.length, percent = Math.round((score * 100) / total), passed = percent >= quiz.passPercent;
  const attempt = await prisma.quizAttempt.create({
    data: { quizId: quiz.id, userId: user.id, score, total, percent, passed, answers: graded.map(g => g.picked) },
  });
  // A passed quiz marks its lesson complete, which is what drives course completion.
  if (passed) {
    await prisma.$transaction(async tx => {
      await enrol(tx, user.id, quiz.lesson.courseId);
      await tx.lessonProgress.upsert({
        where: { userId_lessonId: { userId: user.id, lessonId: quiz.lessonId } },
        update: {}, create: { userId: user.id, lessonId: quiz.lessonId, courseId: quiz.lesson.courseId },
      });
    });
  }
  return { id: attempt.id, score, total, percent, passed, pass_percent: quiz.passPercent, results: graded };
});

// ── Discussion ──
member('GET', '/courses/:id/discussion', async ({ params, query }) =>
  data.getDiscussion(+params.id, query.get('lesson_id') ? +query.get('lesson_id')! : undefined));

member('POST', '/courses/:id/discussion', async ({ user, params, json }) => {
  if (!(await prisma.course.findFirst({ where: { id: +params.id, published: true } }))) fail(404, 'Course not found.');
  const raw = await json() as Record<string, unknown>;
  const body = String(raw.body || '').trim().slice(0, 2000);
  if (body.length < 2) fail(400, 'Write a message before posting.');
  await limit('disc:' + user.id, 20, 3600e3);
  const lessonId = raw.lesson_id ? Math.trunc(Number(raw.lesson_id)) : null;
  if (lessonId && !(await prisma.lesson.findFirst({ where: { id: lessonId, courseId: +params.id } }))) fail(400, 'That lesson is not part of this course.');
  const p = await prisma.discussionPost.create({ data: { courseId: +params.id, lessonId, userId: user.id, body } });
  return { id: p.id, lesson_id: p.lessonId, body: p.body, createdAt: p.createdAt, name: user.fullName, country: user.country, avatar_url: user.avatarUrl };
});

member('DELETE', '/discussion/:id', async ({ user, params }) => {
  const p = await prisma.discussionPost.findUnique({ where: { id: +params.id } });
  if (!p) fail(404, 'Message not found.');
  if (p!.userId !== user.id && user.role !== 'admin') fail(403, 'You can only delete your own messages.');
  await prisma.discussionPost.delete({ where: { id: p!.id } });
  return { ok: true };
});

// Signed, expiring links for private eBook PDFs
pub('GET', '/files/:name', async ({ params, query }) => {
  // M-09: validate filename format before serving
  const n = params.name;
  if (!/^[a-f0-9]+\.pdf$/.test(n)) fail(403, 'Invalid file reference.');
  const exp = query.get('exp') || '', sig = query.get('sig') || '';
  const ok = crypto.createHmac('sha256', secret()).update(n + exp).digest('hex');
  if (!(+exp > Date.now() / 1000) || sig.length !== ok.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(ok)))
    fail(403, 'This link has expired.');
  const location = await createPrivateFileUrl(n);
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});

member('POST', '/lessons/:id/complete', async ({ user, params }) => {
  const lesson = await prisma.lesson.findUnique({
    where: { id: +params.id },
    include: { course: { select: { published: true, priceGhs: true, priceNgn: true } } },
  }) ?? fail(404, 'Lesson not found.');
  if (!isLessonInPublishedCourse(lesson)) fail(404, 'Lesson not found.');
  const enrollment = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: lesson.courseId } } });
  const price = user.country === 'GH' ? lesson.course.priceGhs : lesson.course.priceNgn;
  if (!canAccessCourse({ activated: user.status === 'activated', preview: lesson.preview, price, paidAt: enrollment?.paidAt ?? null }))
    fail(402, price == null ? 'Activate your account or contact support to continue.' : 'Purchase this course to continue.');
  const l = lesson;
  const courseReward = await cfg<Record<string, number>>('course_reward');
  return prisma.$transaction(async tx => {
    const course = await tx.course.findFirst({ where: { id: l.courseId, published: true } })
      ?? fail(404, 'Lesson not found.');
    await enrol(tx, user.id, l.courseId);
    await tx.lessonProgress.upsert({
      where: { userId_lessonId: { userId: user.id, lessonId: l.id } },
      update: {}, create: { userId: user.id, lessonId: l.id, courseId: l.courseId },
    });
    const [total, done] = await Promise.all([
      tx.lesson.count({ where: { courseId: l.courseId } }),
      tx.lessonProgress.count({ where: { userId: user.id, courseId: l.courseId } }),
    ]);
    const percent = Math.floor((done * 100) / Math.max(total, 1));
    const key = { userId_courseId: { userId: user.id, courseId: l.courseId } };
    let e = await tx.enrollment.findUniqueOrThrow({ where: key });
    if (percent >= 100 && !e.completedAt) {
      const code = crypto.randomBytes(16).toString('hex').toUpperCase();
      if ((await tx.enrollment.updateMany({
        where: { userId: user.id, courseId: l.courseId, completedAt: null },
        data: { completedAt: new Date(), certCode: code },
      })).count) {
        if (course.rewardEligible && user.eligible) {
          await entry(tx, user.id, 'pending', courseReward[user.country], 'reward', `CRS-${user.id}-${course.id}`);
          await notify(tx, user.id, 'Course reward pending', `You completed "${course.title}". Your reward is pending validation.`, '/earnings');
        }
        await notify(tx, user.id, 'Certificate ready', `You completed "${course.title}".`, '/certificate/' + code);
      }
      e = await tx.enrollment.findUniqueOrThrow({ where: key });
    }
    return { percent, completed: !!e.completedAt, cert_code: e.certCode };
  });
});

member('POST', '/courses/:id/reviews', async ({ user, params, json }) => {
  const raw = await json() as Record<string, unknown>;
  const r = Math.round(+(raw.rating ?? 0)), body = String(raw.body || '').trim().slice(0, 1000), courseId = +params.id;
  if (!(r >= 1 && r <= 5)) fail(400, 'Choose a rating from 1 to 5.');
  if (!(await prisma.lessonProgress.findFirst({ where: { userId: user.id, courseId } })))
    fail(403, 'Finish at least one lesson before reviewing.');
  await prisma.review.upsert({
    where: { userId_courseId: { userId: user.id, courseId } },
    update: { rating: r, body, status: 'published' },
    create: { userId: user.id, courseId, rating: r, body },
  });
  await data.rate(courseId);
  clearCache();
  return { ok: true };
});

// ── Learner dashboard extras: streaks, achievements, upcoming work, payment history ──
member('GET', '/me/learning-stats', async ({ user }) => data.getLearningStats(user.id));

member('GET', '/me/upcoming', async ({ user }) => {
  const rows = await prisma.enrollment.findMany({
    where: { userId: user.id, completedAt: null },
    orderBy: { createdAt: 'desc' },
    include: { course: { select: { id: true, title: true, lessons: { orderBy: [{ sort: 'asc' }, { id: 'asc' }], select: { id: true, title: true, kind: true, minutes: true } } } } },
  });
  const done = await prisma.lessonProgress.findMany({ where: { userId: user.id }, select: { lessonId: true } });
  const doneSet = new Set(done.map(d => d.lessonId));
  const attempts = await prisma.quizAttempt.findMany({ where: { userId: user.id }, orderBy: { id: 'desc' }, select: { quizId: true, passed: true } });
  const passedQuizzes = new Set(attempts.filter(a => a.passed).map(a => a.quizId));
  const quizzes = await prisma.quiz.findMany({
    where: { lesson: { courseId: { in: rows.map(r => r.course.id) } } },
    select: { id: true, lessonId: true, passPercent: true, _count: { select: { questions: true } } },
  });
  const quizByLesson = new Map(quizzes.map(q => [q.lessonId, q]));
  return rows.map(r => {
    const next = r.course.lessons.find(l => !doneSet.has(l.id)) ?? r.course.lessons[0];
    const remaining = r.course.lessons.filter(l => !doneSet.has(l.id)).length;
    const quiz = next ? quizByLesson.get(next.id) : undefined;
    return {
      course_id: r.course.id, title: r.course.title, remaining, total: r.course.lessons.length,
      next_lesson: next ? { id: next.id, title: next.title, kind: next.kind, minutes: next.minutes } : null,
      quiz: quiz ? { id: quiz.id, questions: quiz._count.questions, pass_percent: quiz.passPercent, passed: passedQuizzes.has(quiz.id) } : null,
      due_at: r.createdAt.getTime() + 14 * 864e5,
    };
  });
});

member('GET', '/me/payments', async ({ user }) => {
  const [payments, withdrawals, ledger] = await Promise.all([
    prisma.payment.findMany({ where: { userId: user.id }, orderBy: { id: 'desc' }, take: 50 }),
    prisma.withdrawal.findMany({ where: { userId: user.id }, orderBy: { id: 'desc' }, take: 50 }),
    prisma.ledgerEntry.findMany({ where: { userId: user.id }, orderBy: { id: 'desc' }, take: 100 }),
  ]);
  const history = [
    ...payments.map(p => ({ id: 'p' + p.id, kind: 'activation_payment', label: 'Activation fee', amount: -p.amount, currency: p.currency, status: p.status, createdAt: p.createdAt })),
    ...withdrawals.map(w => ({ id: 'w' + w.id, kind: 'withdrawal', label: 'Withdrawal', amount: -w.amount, currency: w.currency, status: w.status, createdAt: w.createdAt })),
    ...ledger.filter(l => l.kind === 'reward' && l.amount > 0).map(l => ({ id: 'l' + l.id, kind: 'reward', label: 'Reward credited', amount: l.amount, currency: CUR[user.country], status: 'credited', createdAt: l.createdAt })),
  ].sort((a, b) => +b.createdAt - +a.createdAt);
  return { history: history.slice(0, 60) };
});

// ── Support requests ──
const SupportSchema = z.object({
  name: z.string().min(2, 'Enter your name.').max(100),
  email: z.string().email('Enter a valid email address.'),
  subject: z.string().min(3, 'Add a subject.').max(140),
  body: z.string().min(10, 'Tell us a bit more about the problem.').max(4000),
  category: z.enum(['general', 'payments', 'courses', 'account']).optional(),
});

// Public so signed-out visitors on the contact page can reach support too.
pub('POST', '/support', async c => {
  await limit('support:' + c.ip, 5, 3600e3);
  const parsed = SupportSchema.safeParse(await c.json());
  if (!parsed.success) fail(400, parsed.error.issues[0].message);
  const b = parsed.data!;
  const me = await userFrom(c.req).catch(() => null);
  const r = await prisma.supportRequest.create({
    data: { userId: me?.id ?? null, name: b.name.trim(), email: b.email.toLowerCase(), subject: b.subject.trim(), body: b.body.trim(), category: b.category ?? 'general' },
  });
  return { id: r.id, ok: true, message: 'Thanks. Our support team will get back to you shortly.' };
});

member('GET', '/me/support', async ({ user }) =>
  prisma.supportRequest.findMany({ where: { userId: user.id }, orderBy: { id: 'desc' }, take: 30,
    select: { id: true, subject: true, category: true, status: true, note: true, createdAt: true, updatedAt: true } }));
