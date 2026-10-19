import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { CUR, APP_URL, PROD, audit, balances, cached, cfg, clearCache, fail, limit, lockUser, move, notify, safeEqual } from './core';
import { provider, ProviderError, type PayStatus } from './providers';
import { member, pub, Res } from './router';

// ---------- activation payments ----------
export async function confirmPayment(reference: string, amount: number, currency: string, status: PayStatus) {
  const p = await prisma.payment.findUnique({ where: { reference } });
  if (!p) return null;
  if (p.status !== 'pending' || status === 'pending') return p; // idempotent: repeats change nothing
  const next = status !== 'success' ? 'failed' : amount !== p.amount || currency !== p.currency ? 'mismatch' : 'success';
  if (p.kind === 'course' && !p.courseId) throw new Error(`Course payment ${reference} has no course ID.`);
  const updated = await prisma.$transaction(async tx => {
    const r = await tx.payment.updateMany({ where: { id: p.id, status: 'pending' }, data: { status: next } }); // atomic gate
    if (!r.count) return false;
    if (next === 'success' && p.kind === 'course') {
      const courseId = p.courseId!;
      const paidAt = new Date();
      const created = await tx.enrollment.createMany({ data: [{ userId: p.userId, courseId, paidAt }], skipDuplicates: true });
      if (created.count) await tx.course.update({ where: { id: courseId }, data: { enrolments: { increment: 1 } } });
      else await tx.enrollment.update({ where: { userId_courseId: { userId: p.userId, courseId } }, data: { paidAt } });
      const course = await tx.course.findUniqueOrThrow({ where: { id: courseId }, select: { title: true } });
      await notify(tx, p.userId, 'Course payment received', `Your payment for "${course.title}" is confirmed. You can start learning.`, `/learn/${courseId}`);
    } else if (next === 'success') {
      await notify(tx, p.userId, 'Payment received', 'Your payment is confirmed. You can now activate your account.', '/activate');
    }
    return true;
  });
  if (updated && next === 'mismatch') await audit(null, 'payment_mismatch', { reference, amount, currency });
  if (!updated) return prisma.payment.findUnique({ where: { reference } });
  return { ...p, status: next };
}

const grantCourseEnrollment = async (userId: number, courseId: number, paidAt?: Date) => prisma.$transaction(async tx => {
  const created = await tx.enrollment.createMany({
    data: [{ userId, courseId, ...(paidAt ? { paidAt } : {}) }],
    skipDuplicates: true,
  });
  if (created.count) await tx.course.update({ where: { id: courseId }, data: { enrolments: { increment: 1 } } });
  if (paidAt && !created.count)
    await tx.enrollment.update({ where: { userId_courseId: { userId, courseId } }, data: { paidAt } });
});

member('POST', '/payments/activation', async ({ user: u }) => {
  await limit('pay:' + u.id, 10, 3600e3);
  if (u.status === 'activated') fail(409, 'Your account is already active.');
  if (!u.emailVerified) fail(403, 'Verify your email address before paying.');
  const open = await prisma.payment.findFirst({ where: { userId: u.id, kind: 'activation', status: 'pending', createdAt: { gt: new Date(Date.now() - 30 * 60e3) } } });
  if (open) return { payment: open, message: 'Your payment is still being verified. Please do not pay again while this transaction is pending.' };
  const P = provider(), reference = 'act_' + crypto.randomUUID().replace(/-/g, ''), amount = (await cfg<Record<string, number>>('activation_fee'))[u.country];
  await prisma.payment.create({ data: { userId: u.id, kind: 'activation', reference, amount, currency: CUR[u.country], provider: P.name } });
  let url: string | null = null;
  try { url = (await P.initialize({ reference, amount, currency: CUR[u.country], email: u.email, callbackUrl: `${APP_URL}/pay-return`, metadata: { user_id: u.id, member_id: u.memberId } })).url; }
  catch { await prisma.payment.update({ where: { reference }, data: { status: 'failed' } }); fail(502, 'We could not start the payment. Please try again in a moment.'); }
  return new Res({ payment: await prisma.payment.findUnique({ where: { reference } }), checkout_url: url }, 201);
});
member('POST', '/payments/courses/:id', async ({ user: u, params }) => {
  await limit('course-pay:' + u.id, 10, 3600e3);
  if (u.status === 'activated') fail(409, 'Your active account already includes course access.');
  if (!u.emailVerified) fail(403, 'Verify your email address before paying.');
  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id < 1) fail(404, 'Course not found.');
  const course = await prisma.course.findFirst({
    where: { id, published: true },
    select: { id: true, title: true, priceGhs: true, priceNgn: true },
  });
  if (!course) return fail(404, 'Course not found.');
  const amount = u.country === 'GH' ? course.priceGhs : course.priceNgn;
  if (amount == null) return fail(409, 'This course is not priced yet. Please check back later.');
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error(`Course ${id} has an invalid configured price.`);
  if (amount === 0) {
    await grantCourseEnrollment(u.id, id);
    return { unlocked: true };
  }
  const existing = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: u.id, courseId: id } } });
  if (existing?.paidAt) return { unlocked: true };
  const open = await prisma.payment.findFirst({
    where: { userId: u.id, kind: 'course', courseId: id, status: 'pending', createdAt: { gt: new Date(Date.now() - 30 * 60e3) } },
  });
  if (open) return { payment: open, message: 'Your course payment is still being verified. Please do not pay again while this transaction is pending.' };
  const P = provider(), reference = 'crs_' + crypto.randomUUID().replace(/-/g, ''), currency = CUR[u.country];
  await prisma.payment.create({ data: { userId: u.id, kind: 'course', courseId: id, reference, amount, currency, provider: P.name } });
  let url: string | null = null;
  try {
    url = (await P.initialize({
      reference, amount, currency, email: u.email, callbackUrl: `${APP_URL}/pay-return`,
      metadata: { user_id: u.id, course_id: id, course_title: course.title, member_id: u.memberId },
    })).url;
  } catch {
    await prisma.payment.update({ where: { reference }, data: { status: 'failed' } });
    fail(502, 'We could not start the payment. Please try again in a moment.');
  }
  return new Res({ payment: await prisma.payment.findUnique({ where: { reference } }), checkout_url: url }, 201);
});
member('GET', '/payments/:ref', async ({ user, params }) => {
  let p = await prisma.payment.findFirst({ where: { reference: params.ref, userId: user.id } });
  if (!p) fail(404, 'Payment not found.');
  if (p!.status === 'pending' && provider().live) { // do not rely on the webhook alone
    await limit('chk:' + p!.id, 12, 60e3);
    try { const v = await provider().verify(p!.reference); p = ((await confirmPayment(p!.reference, v.amount, v.currency, v.status)) as typeof p) || p; } catch { /* keep pending */ }
  }
  return p;
});
// C-02: dev simulator only available when ENABLE_DEV_ROUTES=true (never in production)
if (process.env.ENABLE_DEV_ROUTES === 'true' && !PROD) {
  member('POST', '/dev/payments/:ref/succeed', async ({ user, params }) => {
    const p = await prisma.payment.findFirst({ where: { reference: params.ref, userId: user.id } });
    if (!p) fail(404, 'Payment not found.');
    return confirmPayment(p!.reference, p!.amount, p!.currency, 'success');
  });
}

// ---------- withdrawals ----------
const MOMO: Record<string, string> = { 'MTN Mobile Money': 'MTN', 'Telecel Cash': 'VOD', 'AirtelTigo Money': 'ATL' };
export async function finishWithdrawal(id: number, ok: boolean, note?: string | null) {
  return prisma.$transaction(async tx => {
    const r = await tx.withdrawal.updateMany({ where: { id, status: { in: ['processing', 'review'] } }, data: { status: ok ? 'completed' : 'failed', note: note ?? null } });
    if (!r.count) return null;
    const w = await tx.withdrawal.findUniqueOrThrow({ where: { id } });
    if (ok) { await move(tx, w.userId, 'held', 'withdrawn', w.amount, 'withdrawal_paid', `WD-${id}-paid`); await notify(tx, w.userId, 'Withdrawal completed', 'Your withdrawal has been paid.', '/withdraw'); }
    else { await move(tx, w.userId, 'held', 'available', w.amount, 'withdrawal_release', `WD-${id}-release`); await notify(tx, w.userId, 'Withdrawal failed', 'The payout could not be completed and your funds are back in your balance.', '/withdraw'); }
    return w;
  });
}
const refFor = (id: number) => 'lewd_' + String(id).padStart(11, '0'); // stable → provider rejects duplicates, so retries cannot double-pay
export async function dispatchPayout(id: number) {
  const w = await prisma.withdrawal.findFirst({ where: { id, status: 'processing' }, include: { user: true } });
  if (!w) return;
  const P = provider();
  try {
    let rc = w.recipientCode;
    if (!rc) {
      const momo = MOMO[w.method];
      rc = await P.createRecipient({ type: momo ? 'mobile_money' : w.user.country === 'GH' ? 'ghipss' : 'nuban', name: w.accountName, account_number: w.accountNumber, bank_code: momo || w.bankCode || '', currency: w.currency });
      await prisma.withdrawal.update({ where: { id }, data: { recipientCode: rc } });
    }
    await prisma.withdrawal.update({ where: { id }, data: { providerRef: refFor(id) } });
    const t = await P.transfer({ reference: refFor(id), amount: w.amount - w.fee, recipient: rc, reason: 'Withdrawal' });
    if (t.status === 'success') await finishWithdrawal(id, true); else if (t.status === 'failed') await finishWithdrawal(id, false, 'Rejected by payment provider');
  } catch (e) {
    if (e instanceof ProviderError && e.http >= 400 && e.http < 500 && e.http !== 429) { await audit(null, 'payout_rejected', { id, msg: e.message }); await finishWithdrawal(id, false, e.message); }
    else console.error('payout will be retried', id, (e as Error).message);
  }
}
let busy = false;
/** Retries unsent payouts, reconciles sent ones, completes mock payouts. Started by instrumentation.ts and /api/v1/cron/reconcile. */
export async function reconcile() {
  if (busy) return; busy = true;
  try {
    const P = provider();
    for (const w of await prisma.withdrawal.findMany({ where: { status: 'processing' } })) {
      const age = Date.now() - w.createdAt.getTime();
      if (!P.live) { if (age > (+(process.env.MOCK_PAYOUT_SECONDS || 15)) * 1000) await finishWithdrawal(w.id, true, 'mock'); continue; }
      if (!w.providerRef) { await dispatchPayout(w.id); continue; }
      if (age > 90e3) { try { const t = await P.verifyTransfer(w.providerRef); if (t.status !== 'pending') await finishWithdrawal(w.id, t.status === 'success', t.status === 'success' ? null : 'Provider reported failure'); } catch (e) { console.error('verify transfer', (e as Error).message); } }
    }
  } finally { busy = false; }
}
pub('GET', '/cron/reconcile', async ({ req }) => {
  const cronSecret = process.env.CRON_SECRET || '';
  const provided = (req.headers.get('authorization') || '').replace('Bearer ', '');
  if (!cronSecret || !safeEqual(provided, cronSecret)) fail(401, 'Unauthorized.');
  await reconcile(); return { ok: true };
});

member('GET', '/withdrawals/options', async ({ user: u }) => {
  const c = u.country, P = provider(); let banks: { name: string; code: string }[] = [];
  try { banks = await cached('banks' + c, 86400, () => P.banks(c)); } catch { clearCache(); }
  return { currency: CUR[c], methods: (await cfg<Record<string, string[]>>('payout_methods'))[c], min: (await cfg<Record<string, number>>('min_withdrawal'))[c], fee_percent: await cfg('withdrawal_fee_percent'), banks, verify_account: c === 'NG' && P.live };
});
member('POST', '/withdrawals/verify-account', async c => {
  await limit('va:' + c.user.id, 20, 3600e3);
  const b = await c.json() as { account_number: string; bank_code: string };
  return provider().resolve(b);
});
member('GET', '/withdrawals', async ({ user }) => prisma.withdrawal.findMany({ where: { userId: user.id }, orderBy: { id: 'desc' }, take: 100, select: { id: true, amount: true, fee: true, currency: true, method: true, status: true, note: true, createdAt: true } }));
member('POST', '/withdrawals', async c => {
  const u = c.user, b = await c.json() as Record<string, unknown>;
  await limit('wd:' + u.id, 10, 3600e3);
  if (u.status !== 'activated' || !u.eligible) fail(403, 'Activate your account to withdraw.');
  if (!u.emailVerified) fail(403, 'Verify your email address before withdrawing.');
  if (!b.idempotency_key) fail(400, 'Missing request key.');
  const idempotencyKey = String(b.idempotency_key);
  const dup = await prisma.withdrawal.findUnique({ where: { userId_idempotencyKey: { userId: u.id, idempotencyKey } } });
  if (dup) return dup;
  const rawAmount = Number(b.amount);
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) fail(400, 'Enter a valid amount.');
  const amount = Math.round(rawAmount * 100);
  const MAX_WITHDRAWAL = 10_000_000;
  if (amount > MAX_WITHDRAWAL) fail(400, 'Amount exceeds the maximum single withdrawal limit.');
  const methods = (await cfg<Record<string, string[]>>('payout_methods'))[u.country];
  if (amount < (await cfg<Record<string, number>>('min_withdrawal'))[u.country]) fail(400, 'The amount is below the minimum withdrawal.');
  const method = String(b.method || '');
  if (!methods.includes(method)) fail(400, 'Choose a payout method available in your country.');
  const accountNumber = String(b.account_number || '');
  const accountName = String(b.account_name || '').trim();
  const bankCode = b.bank_code ? String(b.bank_code) : null;
  if (!/^[\w\s+-]{6,30}$/.test(accountNumber) || accountName.length < 3) fail(400, 'Check the account name and number.');
  if (!MOMO[method] && !bankCode) fail(400, 'Choose your bank.');
  const fee = Math.round(amount * (await cfg<number>('withdrawal_fee_percent')) / 100);
  const review = amount >= (await cfg<Record<string, number>>('withdrawal_review_above'))[u.country];
  let w;
  try {
    w = await prisma.$transaction(async tx => {
      await lockUser(tx, u.id);
      if ((await balances(tx, u.id)).available < amount) fail(400, 'Your available balance is too low for this withdrawal.');
      const created = await tx.withdrawal.create({ data: { userId: u.id, amount, fee, currency: CUR[u.country], method, bankCode: MOMO[method] ? null : bankCode, accountName, accountNumber, status: review ? 'review' : 'processing', idempotencyKey } });
      await move(tx, u.id, 'available', 'held', amount, 'withdrawal_hold', `WD-${created.id}-hold`);
      await notify(tx, u.id, review ? 'Withdrawal under review' : 'Withdrawal submitted', review ? 'Large withdrawals are checked by our team before payout.' : 'We are processing your withdrawal.', '/withdraw');
      return created;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
      return prisma.withdrawal.findUnique({ where: { userId_idempotencyKey: { userId: u.id, idempotencyKey } } });
    throw e;
  }
  if (!review) void dispatchPayout(w.id);
  return new Res(w, 201);
});

// ---------- provider webhook ----------
pub('POST', '/webhooks/paystack', async c => {
  const P = provider(), raw = await c.text();
  if (!P.live || !P.verifyWebhook(raw, c.req.headers.get('x-paystack-signature'))) return new Res({ error: 'Bad signature.' }, 401);
  const ev = P.parseWebhook(JSON.parse(raw || '{}'));
  if (ev?.kind === 'payment') await confirmPayment(ev.reference, ev.amount ?? 0, ev.currency ?? '', ev.status);
  if (ev?.kind === 'transfer') { const w = await prisma.withdrawal.findFirst({ where: { providerRef: ev.reference } }); if (w) await finishWithdrawal(w.id, ev.status === 'success', ev.status === 'success' ? null : 'Provider reported failure'); }
  return { ok: true }; // always 200 once the signature is valid
});
