// CMS / admin API (role "admin"). The /admin web app, and any future mobile admin, use these same endpoints.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { revalidatePath } from 'next/cache';
import { prisma } from '../db';
import { audit, balances, camelKey, clearCache, fail, move } from '../core';
import { admin } from '../router';
import { confirmPayment, dispatchPayout, finishWithdrawal } from '../payments';
import { provider } from '../providers';
import { rate } from '../data';
import { UPLOADS } from './app';

const touch = () => { clearCache(); try { revalidatePath('/', 'layout'); } catch { /* outside a request */ } };

type F = 's' | 's?' | 'i' | 'b' | 'j' | 'n';
const SPEC: Record<string, { model: string; f: Record<string, F> }> = {
  categories: { model: 'category', f: { name: 's', description: 's?', thumb_url: 's?', sort: 'i' } },
  courses: { model: 'course', f: { title: 's', author: 's?', category_id: 'n', level: 's', description: 's?', cover_url: 's?', minutes: 'i', language: 's', learn_points: 'j', skills: 's', reward_eligible: 'b', published: 'b' } },
  facts: { model: 'fact', f: { title: 's', body: 's', image_url: 's?', link_url: 's?', active: 'b' } },
  lessons: { model: 'lesson', f: { course_id: 'i', title: 's', kind: 's', content: 's?', url: 's?', minutes: 'i', preview: 'b', sort: 'i' } },
  resources: { model: 'lessonResource', f: { lesson_id: 'i', title: 's', url: 's', kind: 's', size: 'n', sort: 'i' } },
  questions: { model: 'quizQuestion', f: { quiz_id: 'i', prompt: 's', options: 'j', answer_index: 'i', explanation: 's?', sort: 'i' } }
};
function shape(table: string, body: Record<string, unknown>) {
  const spec = SPEC[table] ?? fail(404, 'Unknown content type.'), out: Record<string, unknown> = {};
  for (const [k, t] of Object.entries(spec.f)) {
    if (!(k in body)) continue; const v = body[k];
    out[camelKey(k)] = t === 's' ? String(v ?? '') : t === 's?' ? (v == null || v === '' ? null : String(v)) : t === 'i' ? Math.round(Number(v) || 0)
      : t === 'b' ? v === true || v === 1 || v === '1' : t === 'j' ? (Array.isArray(v) ? v : []) : v == null || v === '' || v === 0 ? null : Number(v);
  }
  return { model: (prisma as any)[spec.model], data: out };
}

admin('GET', '/admin/stats', async () => {
  const [users, activated, courses, signups7d, revenue, pending, needsReview, mismatches] = await Promise.all([
    prisma.user.count({ where: { role: 'member' } }), prisma.user.count({ where: { role: 'member', status: 'activated' } }), prisma.course.count(),
    prisma.user.count({ where: { registeredAt: { gt: new Date(Date.now() - 7 * 864e5) } } }),
    prisma.payment.groupBy({ by: ['currency'], where: { status: 'success' }, _sum: { amount: true }, _count: true }),
    prisma.withdrawal.groupBy({ by: ['currency'], where: { status: { in: ['processing', 'review'] } }, _sum: { amount: true }, _count: true }),
    prisma.withdrawal.count({ where: { status: 'review' } }), prisma.payment.count({ where: { status: 'mismatch' } })]);
  return { users, activated, courses, signups7d, needsReview, mismatches, provider: provider().name,
    revenue: revenue.map(r => ({ currency: r.currency, total: r._sum.amount, n: r._count })), pendingWithdrawals: pending.map(r => ({ currency: r.currency, total: r._sum.amount, n: r._count })) };
});
admin('GET', '/admin/users', async ({ query }) => {
  const q = query.get('q')?.trim();
  return prisma.user.findMany({ where: q ? { OR: ['username', 'email', 'memberId'].map(f => ({ [f]: { contains: q, mode: 'insensitive' } })) as any } : {}, orderBy: { id: 'desc' }, take: 200,
    select: { id: true, memberId: true, username: true, email: true, fullName: true, country: true, status: true, eligible: true, emailVerified: true, suspended: true, role: true, registeredAt: true } });
});
admin('PATCH', '/admin/users/:id', async c => {
  const u = await prisma.user.findUnique({ where: { id: +c.params.id } });
  if (!u || u.role === 'admin') fail(400, 'Cannot change this user.');
  const b = await c.json() as Record<string, unknown>;
  await prisma.user.update({ where: { id: u!.id }, data: { suspended: !!b.suspended } });
  await audit(c.user.id, 'suspend', { id: u!.id, v: !!b.suspended });
  return { ok: true };
});
admin('GET', '/admin/payments', async () => (await prisma.payment.findMany({ orderBy: { id: 'desc' }, take: 200, include: { user: { select: { username: true } } } })).map(({ user, ...p }) => ({ ...p, username: user.username })));
admin('POST', '/admin/payments/:ref/verify', async c => {
  const P = provider(); if (!P.live) fail(400, 'No live provider configured.');
  const v = await P.verify(c.params.ref); return confirmPayment(c.params.ref, v.amount, v.currency, v.status);
});
admin('GET', '/admin/withdrawals', async () => (await prisma.withdrawal.findMany({ orderBy: { id: 'desc' }, take: 200, include: { user: { select: { username: true } } } })).map(({ user, ...w }) => ({ ...w, username: user.username })));
admin('PATCH', '/admin/withdrawals/:id', async c => {
  const id = +c.params.id, b = await c.json() as Record<string, unknown>, a = String(b.action || '');
  if (a === 'approve') { if (!(await prisma.withdrawal.updateMany({ where: { id, status: 'review' }, data: { status: 'processing' } })).count) fail(409, 'Not awaiting review.'); void dispatchPayout(id); }
  else if (a === 'complete' || a === 'fail') { if (!(await finishWithdrawal(id, a === 'complete', b.note != null ? String(b.note) : null))) fail(409, 'Withdrawal is not open.'); }
  else fail(400, 'action must be approve, complete or fail');
  await audit(c.user.id, 'withdrawal_' + a, { id }); return { ok: true };
});
admin('POST', '/admin/rewards/settle/:userId', async c => { // pending -> available once you have validated the reward
  const uid = +c.params.userId;
  const settled = await prisma.$transaction(async tx => { const p = (await balances(tx, uid)).pending; if (p > 0) await move(tx, uid, 'pending', 'available', p, 'reward_settle', `SET-${uid}-${Date.now()}`); return p; });
  await audit(c.user.id, 'settle', { user: uid, amount: settled }); return { settled };
});
admin('GET', '/admin/settings', async () => Object.fromEntries((await prisma.setting.findMany()).map(r => [r.key, r.value])));
admin('PUT', '/admin/settings/:key', async c => {
  const b = await c.json() as Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = b.value as any;
  await prisma.setting.upsert({ where: { key: c.params.key }, update: { value }, create: { key: c.params.key, value } });
  await audit(c.user.id, 'setting', { key: c.params.key }); touch(); return { ok: true };
});
admin('GET', '/admin/content/:t', async ({ params, query }) => {
  const { model } = shape(params.t, {}), cid = query.get('course_id');
  return model.findMany({ where: cid ? { courseId: +cid } : {}, orderBy: params.t === 'lessons' ? [{ sort: 'asc' }, { id: 'asc' }] : { id: 'desc' } });
});
admin('POST', '/admin/content/:t', async c => { const { model, data } = shape(c.params.t, await c.json() as Record<string, unknown>); const r = await model.create({ data }); touch(); return { id: r.id }; });
admin('PUT', '/admin/content/:t/:id', async c => { const { model, data } = shape(c.params.t, await c.json() as Record<string, unknown>); if (Object.keys(data).length) await model.update({ where: { id: +c.params.id }, data }); touch(); return { ok: true }; });
admin('DELETE', '/admin/content/:t/:id', async c => { const { model } = shape(c.params.t, {}); await model.delete({ where: { id: +c.params.id } }); touch(); return { ok: true }; });
admin('GET', '/admin/pages', async () => prisma.page.findMany({ orderBy: { slug: 'asc' } }));
admin('PUT', '/admin/pages/:slug', async c => {
  if (!/^[a-z0-9-]{2,40}$/.test(c.params.slug)) fail(400, 'Slug: lowercase letters, numbers, dashes.');
  const b = await c.json() as Record<string, unknown>;
  await prisma.page.upsert({ where: { slug: c.params.slug }, update: { title: String(b.title || ''), body: String(b.body || '') }, create: { slug: c.params.slug, title: String(b.title || ''), body: String(b.body || '') } });
  touch(); return { ok: true };
});
admin('DELETE', '/admin/pages/:slug', async c => { await prisma.page.delete({ where: { slug: c.params.slug } }); touch(); return { ok: true }; });
admin('GET', '/admin/reviews', async () => (await prisma.review.findMany({ orderBy: { id: 'desc' }, take: 200, include: { user: { select: { username: true } }, course: { select: { title: true } } } })).map(({ user, course, ...r }) => ({ ...r, username: user.username, course: course.title })));
admin('PATCH', '/admin/reviews/:id', async c => {
  const r = await prisma.review.findUnique({ where: { id: +c.params.id } });
  if (!r) fail(404, 'Not found.');
  const b = await c.json() as Record<string, unknown>;
  await prisma.review.update({ where: { id: r!.id }, data: { status: b.status === 'hidden' ? 'hidden' : 'published' } });
  await rate(r!.courseId); touch(); return { ok: true };
});
admin('GET', '/admin/audit', async () => prisma.auditLog.findMany({ orderBy: { id: 'desc' }, take: 200 }));
admin('POST', '/admin/upload', async c => {
  const type = (c.req.headers.get('content-type') || '').split(';')[0];
  const buf = Buffer.from(await c.req.arrayBuffer());
  const id = crypto.randomBytes(12).toString('hex');
  if (!buf.length || buf.length > 12e6) fail(400, 'No file received (max 12 MB).');
  fs.mkdirSync(path.join(UPLOADS, 'public'), { recursive: true });
  fs.mkdirSync(path.join(UPLOADS, 'private'), { recursive: true });
  if (type === 'application/pdf') {
    // H-05: verify PDF magic bytes (%PDF)
    if (buf[0] !== 0x25 || buf[1] !== 0x50 || buf[2] !== 0x44 || buf[3] !== 0x46)
      fail(400, 'File content does not appear to be a valid PDF.');
    fs.writeFileSync(path.join(UPLOADS, 'private', id + '.pdf'), buf);
    return { url: 'private:' + id + '.pdf' };
  }
  // H-05: verify image magic bytes
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(type))
    fail(400, 'Use a PNG, JPG, WebP or GIF image. SVG is not allowed.');
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isWebp = buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
  const isGif = buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38;
  if (!isPng && !isJpeg && !isWebp && !isGif) fail(400, 'File content does not match an allowed image type.');
  const sharp = (await import('sharp')).default;
  await sharp(buf).rotate().resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(UPLOADS, 'public', id + '.webp'));
  await sharp(buf).rotate().resize({ width: 480, withoutEnlargement: true }).webp({ quality: 75 }).toFile(path.join(UPLOADS, 'public', id + '-480.webp'));
  return { url: '/uploads/' + id + '.webp' };
});

// ── Support requests ──
admin('GET', '/admin/support', async ({ query }) => {
  const status = query.get('status')?.trim();
  const rows = await prisma.supportRequest.findMany({
    where: status && status !== 'all' ? { status } : {}, orderBy: { id: 'desc' }, take: 200,
    include: { user: { select: { username: true, memberId: true } } },
  });
  const counts = await prisma.supportRequest.groupBy({ by: ['status'], _count: true });
  return { items: rows.map(({ user, ...r }) => ({ ...r, username: user?.username ?? null, member_id: user?.memberId ?? null })), counts: Object.fromEntries(counts.map(c => [c.status, c._count])) };
});
admin('PATCH', '/admin/support/:id', async c => {
  const b = await c.json() as Record<string, unknown>;
  const allowed = ['open', 'in_progress', 'resolved', 'closed'];
  const status = allowed.includes(String(b.status)) ? String(b.status) : 'open';
  const r = await prisma.supportRequest.update({ where: { id: +c.params.id }, data: { status, note: b.note != null ? String(b.note) : null } });
  await audit(c.user.id, 'support_update', { id: r.id, status });
  return { ok: true };
});

// ── Quiz settings per lesson ──
admin('GET', '/admin/quizzes', async ({ query }) => {
  const cid = query.get('course_id');
  const rows = await prisma.quiz.findMany({
    where: cid ? { courseId: +cid } : {}, orderBy: { id: 'desc' },
    include: { _count: { select: { questions: true, attempts: true } }, lesson: { select: { title: true } } },
  });
  return rows.map(({ lesson, _count, ...q }) => ({ ...q, lesson_title: lesson.title, questions: _count.questions, attempts: _count.attempts }));
});
admin('PUT', '/admin/quizzes/lesson/:lessonId', async c => {
  const lessonId = +c.params.lessonId;
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) fail(404, 'Lesson not found.');
  const b = await c.json() as Record<string, unknown>;
  const pass = Math.min(Math.max(Math.round(Number(b.pass_percent) || 70), 1), 100);
  const title = String(b.title || 'Lesson quiz').slice(0, 140);
  const quiz = await prisma.quiz.upsert({
    where: { lessonId },
    update: { title, passPercent: pass },
    create: { lessonId, courseId: lesson!.courseId, title, passPercent: pass },
  });
  touch(); return { id: quiz.id };
});
admin('DELETE', '/admin/quizzes/:id', async c => { await prisma.quiz.delete({ where: { id: +c.params.id } }); touch(); return { ok: true }; });
admin('GET', '/admin/quizzes/:id/questions', async c => {
  const quiz = await prisma.quiz.findUnique({ where: { id: +c.params.id }, include: { questions: { orderBy: [{ sort: 'asc' }, { id: 'asc' }] } } });
  if (!quiz) fail(404, 'Quiz not found.');
  return quiz!.questions;
});

// ── Course progress monitoring ──
admin('GET', '/admin/progress', async ({ query }) => {
  const cid = query.get('course_id');
  if (cid) {
    const enrollments = await prisma.enrollment.findMany({
      where: { courseId: +cid }, orderBy: { createdAt: 'desc' }, take: 300,
      include: { user: { select: { username: true, fullName: true, country: true } } },
    });
    const total = await prisma.lesson.count({ where: { courseId: +cid } });
    const done = await prisma.lessonProgress.groupBy({ by: ['userId'], where: { courseId: +cid }, _count: true });
    const byUser = new Map(done.map(d => [d.userId, d._count]));
    return { total_lessons: total, items: enrollments.map(({ user, ...e }) => ({ user_id: e.userId, username: user.username, full_name: user.fullName, country: user.country, lessons_done: byUser.get(e.userId) ?? 0, completed_at: e.completedAt, cert_code: e.certCode })) };
  }
  const courses = await prisma.course.findMany({
    orderBy: { id: 'desc' }, take: 100,
    select: { id: true, title: true, published: true, enrolments: true, _count: { select: { lessons: true, enrollments: true } } },
  });
  const completions = await prisma.enrollment.groupBy({ by: ['courseId'], where: { completedAt: { not: null } }, _count: true });
  const byCourse = new Map(completions.map(c => [c.courseId, c._count]));
  return courses.map(({ _count, ...c }) => ({ ...c, lessons: _count.lessons, enrolled: _count.enrollments, completed: byCourse.get(c.id) ?? 0 }));
});

// ── Instructors (admin-role users) ──
admin('GET', '/admin/instructors', async () => {
  const rows = await prisma.user.findMany({
    where: { role: { in: ['admin', 'instructor'] } }, orderBy: { id: 'asc' },
    select: { id: true, memberId: true, username: true, email: true, fullName: true, country: true, role: true, suspended: true, registeredAt: true },
  });
  return Promise.all(rows.map(async r => ({
    ...r, courses: await prisma.course.count({ where: { author: r.fullName } }),
  })));
});
admin('POST', '/admin/instructors', async c => {
  const b = await c.json() as Record<string, unknown>;
  const username = String(b.username || '').trim().toLowerCase();
  const email = String(b.email || '').trim().toLowerCase();
  const fullName = String(b.full_name || '').trim();
  const password = String(b.password || '');
  const country = b.country === 'NG' ? 'NG' : 'GH';
  if (!/^[a-z0-9_]{3,20}$/.test(username)) fail(400, 'Username must be 3-20 letters, numbers or underscores.');
  if (!/^\S+@\S+\.\S+$/.test(email)) fail(400, 'Enter a valid email address.');
  if (fullName.length < 3) fail(400, 'Enter the instructor name.');
  if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password)) fail(400, 'Password needs 8+ characters with a letter and a number.');
  if (await prisma.user.findFirst({ where: { OR: [{ username }, { email }] } })) fail(400, 'That username or email is already registered.');
  const bcrypt = (await import('bcryptjs')).default;
  let memberId: string;
  do { memberId = 'SL' + crypto.randomInt(1e6, 1e7); } while (await prisma.user.findUnique({ where: { memberId } }));
  const u = await prisma.user.create({
    data: { memberId, username, email, fullName, country, phone: String(b.phone || '+233000000000'), passwordHash: await bcrypt.hash(password, 12), role: 'instructor', status: 'activated', eligible: false, emailVerified: true, deadlineAt: new Date() },
  });
  await audit(c.user.id, 'instructor_create', { id: u.id, username });
  return { id: u.id };
});
admin('PATCH', '/admin/instructors/:id', async c => {
  const b = await c.json() as Record<string, unknown>;
  const u = await prisma.user.findUnique({ where: { id: +c.params.id } });
  if (!u) fail(404, 'Not found.');
  const role = b.role === 'admin' || b.role === 'instructor' || b.role === 'member' ? String(b.role) : u!.role;
  if (u!.role === 'admin' && role !== 'admin' && (await prisma.user.count({ where: { role: 'admin' } })) <= 1)
    fail(400, 'You cannot remove the last administrator.');
  await prisma.user.update({ where: { id: u!.id }, data: { role, suspended: b.suspended !== undefined ? !!b.suspended : u!.suspended } });
  await audit(c.user.id, 'instructor_update', { id: u!.id, role });
  return { ok: true };
});
