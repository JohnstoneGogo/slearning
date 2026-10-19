// In-memory Prisma stub for unit tests.
//
// IMPORTANT: src/server/db.ts binds `prisma` from globalThis.prisma at module-evaluation
// time. ESM evaluates imports before the importing module's own statements, so the stub
// must install its client as a side effect of THIS module being evaluated — a factory
// called later would be too late and payments.ts would keep the real client.
//
// We therefore install one stable client object now and let makePrismaStub() only reset
// its in-memory tables. Because db.ts captured the object reference (not a deep copy),
// resetting the tables in place is visible to the module under test.
import { Prisma, PrismaClient } from '@prisma/client';

export interface PaymentRow {
  id: number;
  userId: number;
  kind: string;
  courseId: number | null;
  reference: string;
  amount: number;
  currency: string;
  provider: string;
  status: string;
  createdAt: Date;
}

export interface WithdrawalRow {
  id: number;
  userId: number;
  amount: number;
  fee: number;
  currency?: string;
  method?: string;
  status: string;
  idempotencyKey: string;
}

type UpdateCall = { model: string; where: unknown; data: unknown };
type InsertResult<T> = { created: boolean; row: T | null; duplicate?: T | null };

export interface PrismaStub {
  tables: {
    payment: { rows: PaymentRow[] };
    enrollment: { rows: { userId: number; courseId: number; paidAt: Date | null }[] };
    course: { rows: { id: number; title: string; enrolments: number }[] };
    notification: { rows: { userId: number; title: string; body: string; link?: string }[] };
    auditLog: { rows: { actor: number | null; action: string; detail: object }[] };
    ledgerEntry: { rows: { userId: number; account: string; amount: number; kind: string; ref: string }[] };
    withdrawal: { rows: WithdrawalRow[] };
  };
  paymentUpdates: UpdateCall[];
  audits: { actor: number | null; action: string; detail: object }[];
  notificationCount(): number;
  onPaymentUpdateMany(fn: () => { count: number }): void;
  insertWithdrawal(
    row: Omit<WithdrawalRow, 'id' | 'status' | 'currency' | 'method'> & { status?: string; currency?: string; method?: string },
    opts?: { throwOnDuplicate?: boolean },
  ): Promise<InsertResult<WithdrawalRow>>;
}

interface Seed {
  payments?: PaymentRow[];
  enrollments?: { userId: number; courseId: number; paidAt: Date | null }[];
  courses?: { id: number; title: string; enrolments: number }[];
  users?: { id: number; country: string; status: string }[];
}

// --- stable singleton state, reset in place by makePrismaStub() ---
let nextId = 1;
const tables: PrismaStub['tables'] = {
  payment: { rows: [] },
  enrollment: { rows: [] },
  course: { rows: [] },
  notification: { rows: [] },
  auditLog: { rows: [] },
  ledgerEntry: { rows: [] },
  withdrawal: { rows: [] },
};
const paymentUpdates: UpdateCall[] = [];
let updateManyOverride: (() => { count: number }) | null = null;

const duplicateError = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: ['userId', 'idempotencyKey'] },
  });

const tx = {
  payment: {
    findUnique: async ({ where }: { where: { reference: string } }) =>
      tables.payment.rows.find(p => p.reference === where.reference) ?? null,
    findFirst: async ({ where }: { where: { reference?: string; userId?: number } }) =>
      tables.payment.rows.find(
        p =>
          (where.reference === undefined || p.reference === where.reference) &&
          (where.userId === undefined || p.userId === where.userId),
      ) ?? null,
    updateMany: async ({ where, data }: { where: { id: number; status: string }; data: { status: string } }) => {
      paymentUpdates.push({ model: 'payment', where, data });
      if (updateManyOverride) return updateManyOverride();
      const row = tables.payment.rows.find(p => p.id === where.id && p.status === where.status);
      if (!row) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    },
    create: async ({ data }: { data: Omit<PaymentRow, 'id'> & { id?: number } }) => {
      const id = nextId++;
      const row: PaymentRow = { ...data, id };
      tables.payment.rows.push(row);
      return row;
    },
  },
  enrollment: {
    createMany: async ({
      data,
      skipDuplicates,
    }: {
      data: { userId: number; courseId: number; paidAt?: Date }[];
      skipDuplicates?: boolean;
    }) => {
      let count = 0;
      for (const d of data) {
        const exists = tables.enrollment.rows.some(e => e.userId === d.userId && e.courseId === d.courseId);
        if (exists && skipDuplicates) continue;
        tables.enrollment.rows.push({ userId: d.userId, courseId: d.courseId, paidAt: d.paidAt ?? null });
        count += 1;
      }
      return { count };
    },
    findUnique: async ({ where }: { where: { userId_courseId: { userId: number; courseId: number } } }) =>
      tables.enrollment.rows.find(
        e => e.userId === where.userId_courseId.userId && e.courseId === where.userId_courseId.courseId,
      ) ?? null,
    update: async ({
      where,
      data,
    }: {
      where: { userId_courseId: { userId: number; courseId: number } };
      data: { paidAt: Date };
    }) => {
      const row = tables.enrollment.rows.find(
        e => e.userId === where.userId_courseId.userId && e.courseId === where.userId_courseId.courseId,
      );
      if (row) row.paidAt = data.paidAt;
      return row ?? null;
    },
  },
  course: {
    findUniqueOrThrow: async ({ where }: { where: { id: number } }) => {
      const row = tables.course.rows.find(c => c.id === where.id);
      if (!row) throw new Error(`Course ${where.id} not found`);
      return row;
    },
    findUnique: async ({ where }: { where: { id: number } }) =>
      tables.course.rows.find(c => c.id === where.id) ?? null,
    findFirst: async ({ where }: { where: { id: number; published?: boolean } }) =>
      tables.course.rows.find(c => c.id === where.id) ?? null,
    update: async ({ where, data }: { where: { id: number }; data: { enrolments?: { increment: number } } }) => {
      const row = tables.course.rows.find(c => c.id === where.id);
      if (row && data.enrolments?.increment) row.enrolments += data.enrolments.increment;
      return row ?? null;
    },
  },
  notification: {
    create: async ({ data }: { data: { userId: number; title: string; body: string; link?: string } }) => {
      tables.notification.rows.push(data);
      return data;
    },
  },
  auditLog: {
    create: async ({ data }: { data: { actor: number | null; action: string; detail: object } }) => {
      tables.auditLog.rows.push(data);
      return data;
    },
  },
  ledgerEntry: {
    create: async ({
      data,
    }: {
      data: { userId: number; account: string; amount: number; kind: string; ref: string };
    }) => {
      const dup = tables.ledgerEntry.rows.some(e => e.ref === data.ref && e.account === data.account);
      if (dup) throw duplicateError();
      tables.ledgerEntry.rows.push(data);
      return data;
    },
    groupBy: async ({ where }: { where: { userId: number } }) => {
      const byAccount = new Map<string, number>();
      for (const e of tables.ledgerEntry.rows.filter(r => r.userId === where.userId))
        byAccount.set(e.account, (byAccount.get(e.account) ?? 0) + e.amount);
      return [...byAccount].map(([account, amount]) => ({ account, _sum: { amount } }));
    },
    aggregate: async ({ where }: { where: { userId: number; kind: string } }) => ({
      _sum: {
        amount: tables.ledgerEntry.rows
          .filter(r => r.userId === where.userId && r.kind === where.kind)
          .reduce((s, r) => s + r.amount, 0),
      },
    }),
  },
  withdrawal: {
    create: async ({ data }: { data: WithdrawalRow }) => {
      const key = `${data.userId}:${data.idempotencyKey}`;
      if (tables.withdrawal.rows.some(w => `${w.userId}:${w.idempotencyKey}` === key)) throw duplicateError();
      const id = nextId++;
      const row: WithdrawalRow = { ...data, status: data.status ?? 'processing', id };
      tables.withdrawal.rows.push(row);
      return row;
    },
    findUnique: async ({
      where,
    }: {
      where: { userId_idempotencyKey?: { userId: number; idempotencyKey: string }; id?: number };
    }) => {
      if (where.userId_idempotencyKey)
        return (
          tables.withdrawal.rows.find(
            w =>
              w.userId === where.userId_idempotencyKey!.userId &&
              w.idempotencyKey === where.userId_idempotencyKey!.idempotencyKey,
          ) ?? null
        );
      return tables.withdrawal.rows.find(w => w.id === where.id) ?? null;
    },
  },
  $queryRaw: async () => [],
};

const client = {
  ...tx,
  $transaction: async <T>(fn: (t: typeof tx) => Promise<T>): Promise<T> => fn(tx),
};

// Install NOW, at module-evaluation time, before src/server/db.ts is evaluated.
(globalThis as unknown as { prisma: unknown }).prisma = client as unknown as PrismaClient;

/** Resets the singleton's in-memory tables and returns a view for assertions. */
export function makePrismaStub(seed: Seed = {}): PrismaStub {
  nextId = 1;
  tables.payment.rows.length = 0;
  tables.enrollment.rows.length = 0;
  tables.course.rows.length = 0;
  tables.notification.rows.length = 0;
  tables.auditLog.rows.length = 0;
  tables.ledgerEntry.rows.length = 0;
  tables.withdrawal.rows.length = 0;
  paymentUpdates.length = 0;
  updateManyOverride = null;

  tables.payment.rows.push(...(seed.payments ?? []));
  tables.enrollment.rows.push(...(seed.enrollments ?? []));
  tables.course.rows.push(...(seed.courses ?? []));

  return {
    tables,
    paymentUpdates,
    audits: tables.auditLog.rows,
    notificationCount: () => tables.notification.rows.length,
    onPaymentUpdateMany: fn => {
      updateManyOverride = fn;
    },
    async insertWithdrawal(row, opts) {
      const full: WithdrawalRow = { currency: 'GHS', method: 'momo', status: 'processing', ...row } as WithdrawalRow;
      try {
        const created = (await tx.withdrawal.create({ data: full })) as WithdrawalRow;
        return { created: true, row: created, duplicate: null };
      } catch (e) {
        if (opts?.throwOnDuplicate) throw e;
        const existing = await tx.withdrawal.findUnique({
          where: { userId_idempotencyKey: { userId: row.userId, idempotencyKey: row.idempotencyKey } },
        });
        return { created: false, row: null, duplicate: existing };
      }
    },
  };
}
