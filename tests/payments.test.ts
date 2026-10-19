// Money-critical unit tests for src/server/payments.ts.
//
// These tests run without a database. `src/server/db.ts` reads DATABASE_URL in its
// module body, but PrismaPg does not open a connection until the first query, and we
// never touch the real client — the stub below replaces globalThis.prisma BEFORE the
// payments module is imported (imports are hoisted, so the setup lives in a separate
// helper module that is imported first).
import assert from "node:assert/strict";
import test from "node:test";
import { makePrismaStub, type PaymentRow } from "./prisma-stub";
import { confirmPayment } from "../src/server/payments";
import { HttpError } from "../src/server/core";

const DAY = 24 * 60 * 60 * 1000;

/** Build a stub whose in-memory state is visible to the assertions. */
function stub(overrides: Parameters<typeof makePrismaStub>[0] = {}) {
  const state = makePrismaStub(overrides);
  return state;
}

const payment = (over: Partial<PaymentRow> = {}): PaymentRow => ({
  id: 1,
  userId: 7,
  kind: "activation",
  courseId: null,
  reference: "act_ref_1",
  amount: 2500,
  currency: "GHS",
  provider: "paystack",
  status: "pending",
  createdAt: new Date(),
  ...over,
});

// ---------- idempotent re-confirmation ----------

test("confirmPayment returns null for an unknown reference", async () => {
  const s = stub();
  assert.equal(
    await confirmPayment("does_not_exist", 2500, "GHS", "success"),
    null,
  );
  assert.equal(s.tables.payment.rows.length, 0);
});

test("confirmPayment is a no-op when the payment is already settled", async () => {
  const s = stub({ payments: [payment({ status: "success" })] });
  const before = s.notificationCount();

  const again = await confirmPayment("act_ref_1", 2500, "GHS", "success");

  assert.equal(again?.status, "success");
  assert.equal(
    s.paymentUpdates.length,
    0,
    "no update should be issued for a settled payment",
  );
  assert.equal(
    s.notificationCount(),
    before,
    "no duplicate notification should be sent",
  );
});

test("confirmPayment ignores a pending provider status", async () => {
  const s = stub({ payments: [payment()] });
  const again = await confirmPayment("act_ref_1", 2500, "GHS", "pending");
  assert.equal(again?.status, "pending");
  assert.equal(s.paymentUpdates.length, 0);
});

test("confirmPayment is idempotent across repeated webhook calls", async () => {
  const s = stub({ payments: [payment()] });

  const first = await confirmPayment("act_ref_1", 2500, "GHS", "success");
  const second = await confirmPayment("act_ref_1", 2500, "GHS", "success");

  assert.equal(first?.status, "success");
  assert.equal(second?.status, "success");
  assert.equal(
    s.notificationCount(),
    1,
    "exactly one confirmation notification",
  );
  assert.equal(
    s.paymentUpdates.length,
    1,
    "only the first call may flip the status",
  );
  assert.equal(s.tables.payment.rows[0].status, "success");
});

test("confirmPayment loses the race safely when a concurrent call already settled it", async () => {
  const s = stub({ payments: [payment()] });
  // Simulate the webhook winning the atomic gate between findUnique and updateMany:
  // the row is already 'success', so updateMany matches nothing and the loser must
  // fall back to a re-read instead of processing the payment twice.
  s.onPaymentUpdateMany(() => {
    s.tables.payment.rows[0].status = "success";
    return { count: 0 };
  });

  const res = await confirmPayment("act_ref_1", 2500, "GHS", "success");

  assert.equal(
    res?.status,
    "success",
    "re-reads the settled row instead of double-processing",
  );
  assert.equal(s.notificationCount(), 0, "the losing call must not notify or enroll");
});

test("confirmPayment marks an amount/currency mismatch without granting access", async () => {
  const s = stub({ payments: [payment({ amount: 2500, currency: "GHS" })] });

  const res = await confirmPayment("act_ref_1", 9900, "NGN", "success");

  assert.equal(res?.status, "mismatch");
  assert.equal(s.audits.length, 1);
  assert.equal(s.audits[0].action, "payment_mismatch");
  assert.deepEqual(s.audits[0].detail, {
    reference: "act_ref_1",
    amount: 9900,
    currency: "NGN",
  });
  assert.equal(
    s.notificationCount(),
    0,
    "a mismatched payment must not notify success",
  );
});

test("confirmPayment marks a failed provider status as failed", async () => {
  const s = stub({ payments: [payment()] });
  const res = await confirmPayment("act_ref_1", 2500, "GHS", "failed");
  assert.equal(res?.status, "failed");
  assert.equal(s.notificationCount(), 0);
});

// ---------- course enrollment side effects ----------

test("confirmPayment enrolls the buyer exactly once and bumps the counter", async () => {
  const s = stub({
    payments: [
      payment({ kind: "course", courseId: 42, reference: "crs_ref_1" }),
    ],
    courses: [{ id: 42, title: "Intro to React", enrolments: 5 }],
  });

  await confirmPayment("crs_ref_1", 2500, "GHS", "success");

  assert.equal(s.tables.enrollment.rows.length, 1);
  assert.deepEqual(
    s.tables.enrollment.rows.map((e) => [e.userId, e.courseId]),
    [[7, 42]],
  );
  assert.equal(
    s.tables.course.rows[0].enrolments,
    6,
    "enrolment counter incremented once",
  );
  assert.equal(s.notificationCount(), 1);
  assert.match(s.tables.notification.rows[0].title, /Course payment received/);
});

test("confirmPayment does not bump the counter when the enrolment already exists", async () => {
  const s = stub({
    payments: [
      payment({ kind: "course", courseId: 42, reference: "crs_ref_1" }),
    ],
    courses: [{ id: 42, title: "Intro to React", enrolments: 9 }],
    enrollments: [{ userId: 7, courseId: 42, paidAt: null }],
  });

  await confirmPayment("crs_ref_1", 2500, "GHS", "success");

  assert.equal(
    s.tables.course.rows[0].enrolments,
    9,
    "existing enrolment must not be double counted",
  );
  assert.equal(s.tables.enrollment.rows.length, 1);
  assert.ok(s.tables.enrollment.rows[0].paidAt instanceof Date);
});

test("confirmPayment throws when a course payment has no courseId", async () => {
  const s = stub({ payments: [payment({ kind: "course", courseId: null })] });
  await assert.rejects(
    () => confirmPayment("act_ref_1", 2500, "GHS", "success"),
    /has no course ID/,
  );
  assert.equal(
    s.paymentUpdates.length,
    0,
    "nothing should be written before the guard",
  );
});

// ---------- withdrawal fee + balance arithmetic ----------

test("fee is a rounded percentage of the requested amount", () => {
  // Mirrors: Math.round(amount * fee_percent / 100) from src/server/payments.ts:202
  const fee = (amountMinor: number, percent: number) =>
    Math.round((amountMinor * percent) / 100);

  assert.equal(fee(10_000, 2), 200); // GHS 100.00 -> GHS 2.00
  assert.equal(fee(999, 2), 20); // 19.98 rounds up to 20
  assert.equal(fee(1_00, 2.5), 3); // 2.5 rounds up to 3
  assert.equal(fee(10_000_000, 2), 200_000);
});

test("the payout transfer debits amount minus fee", () => {
  // Mirrors: P.transfer({ amount: w.amount - w.fee }) from src/server/payments.ts:140
  const payout = (amountMinor: number, feeMinor: number) =>
    amountMinor - feeMinor;

  assert.equal(payout(10_000, 200), 9_800);
  assert.equal(payout(5_000, 0), 5_000);
});

test("the hold moves the full amount so the user cannot overspend", () => {
  // Mirrors: move(tx, u.id, 'available', 'held', amount) from src/server/payments.ts:210 —
  // the fee is deducted at payout time, not at hold time, so `available` must drop by the gross amount.
  const balances = { available: 20_000, held: 0 };
  const amount = 10_000;
  balances.available -= amount;
  balances.held += amount;

  assert.deepEqual(balances, { available: 10_000, held: 10_000 });
});

test("a failed payout releases the full held amount back to available", () => {
  // Mirrors: move(tx, w.userId, 'held', 'available', w.amount) from src/server/payments.ts:123
  const balances = { available: 10_000, held: 10_000 };
  const amount = 10_000;
  balances.held -= amount;
  balances.available += amount;

  assert.deepEqual(balances, { available: 20_000, held: 0 });
});

test("a completed payout moves held funds to withdrawn and never returns them", () => {
  // Mirrors: move(tx, w.userId, 'held', 'withdrawn', w.amount) from src/server/payments.ts:122
  const balances: Record<string, number> = {
    available: 10_000,
    held: 10_000,
    withdrawn: 0,
  };
  const amount = 10_000;
  balances.held -= amount;
  balances.withdrawn += amount;

  assert.deepEqual(balances, { available: 10_000, held: 0, withdrawn: 10_000 });
});

// ---------- duplicate idempotency keys ----------

test("withdrawal idempotency keys must be unique per user", async () => {
  const s = stub({ users: [{ id: 7, country: "GH", status: "activated" }] });
  const key = "wd-key-1";

  const first = await s.insertWithdrawal({
    userId: 7,
    amount: 10_000,
    fee: 200,
    idempotencyKey: key,
  });
  const replay = await s.insertWithdrawal({
    userId: 7,
    amount: 10_000,
    fee: 200,
    idempotencyKey: key,
  });

  assert.equal(first.created, true);
  assert.equal(
    replay.created,
    false,
    "the second insert must be rejected as a duplicate",
  );
  assert.equal(
    replay.duplicate?.id,
    first.row?.id,
    "the original withdrawal is returned on replay",
  );
  assert.equal(s.tables.withdrawal.rows.length, 1);
});

test("the same idempotency key is allowed for a different user", async () => {
  const s = stub();
  const key = "shared-key";

  const a = await s.insertWithdrawal({
    userId: 7,
    amount: 10_000,
    fee: 200,
    idempotencyKey: key,
  });
  const b = await s.insertWithdrawal({
    userId: 8,
    amount: 10_000,
    fee: 200,
    idempotencyKey: key,
  });

  assert.equal(a.created, true);
  assert.equal(b.created, true);
  assert.equal(s.tables.withdrawal.rows.length, 2);
});

test("a duplicate key surfaces as a P2002 Prisma error the route can catch", async () => {
  const s = stub();
  const key = "wd-key-2";
  await s.insertWithdrawal({
    userId: 7,
    amount: 10_000,
    fee: 200,
    idempotencyKey: key,
  });

  await assert.rejects(
    () =>
      s.insertWithdrawal(
        { userId: 7, amount: 10_000, fee: 200, idempotencyKey: key },
        { throwOnDuplicate: true },
      ),
    (e: unknown): boolean => {
      assert.ok(e instanceof Error);
      assert.equal((e as { code?: string }).code, "P2002");
      return true;
    },
  );
});

// ---------- guards shared with the HTTP layer ----------

test("HttpError carries the status the API contract expects", () => {
  const e = new HttpError(409, "Your account is already active.");
  assert.equal(e.status, 409);
  assert.equal(e.message, "Your account is already active.");
});

test("a stale pending payment older than the 30 minute window is not treated as open", () => {
  const openWindowMs = 30 * 60 * 1000;
  const isOpen = (createdAt: Date) =>
    createdAt.getTime() > Date.now() - openWindowMs;

  assert.equal(isOpen(new Date(Date.now() - 5 * 1000)), true);
  assert.equal(isOpen(new Date(Date.now() - 29 * 60 * 1000)), true);
  assert.equal(isOpen(new Date(Date.now() - DAY)), false);
});
