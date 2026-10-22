import crypto from 'node:crypto';
import { prisma, type Tx } from './db';

export const CUR: Record<string, string> = { GH: 'GHS', NG: 'NGN' };
export const PROD = process.env.NODE_ENV === 'production';
export const APP_URL = (process.env.APP_URL || 'http://localhost:3000').trim().replace(/\/+$/, '');

/**
 * Returns the JWT signing secret.
 * Validates length ≥ 32 chars in production and throws immediately so a
 * misconfigured deployment fails fast rather than silently using a weak key.
 */
export const secret = (): string => {
  const s = process.env.JWT_SECRET || 'dev-secret-change-me';
  if (PROD) {
    if (s.startsWith('dev-') || s.length < 32)
      throw new Error('JWT_SECRET must be at least 32 characters and must not use the default value in production.');
  }
  return s;
};

/** Validate critical env vars at server startup (called from instrumentation-node.ts). */
export function validateEnv() {
  if (!PROD) return;
  const required = ['JWT_SECRET', 'DATABASE_URL', 'APP_URL'];
  for (const k of required) {
    if (!process.env[k]) throw new Error(`Missing required env var: ${k}`);
  }
  if (!process.env.APP_URL?.startsWith('https://'))
    throw new Error('APP_URL must start with https:// in production.');
  secret(); // validates JWT_SECRET length
  if (!process.env.SMTP_URL)
    throw new Error('SMTP_URL is required in production. Emails cannot be sent without it.');
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const fail = (status: number, message: string): never => { throw new HttpError(status, message); };

// ---- settings (JSON rows editable in the CMS) ----
// Memoised in-process (60s, per instance) so the hot paths do not spend a
// pooled connection on a settings row on every request. The CMS write path
// calls clearCache(), which also drops these entries.
const CFG_TTL = 60e3;
const cfgStore = new Map<string, { v: unknown; exp: number }>();
export const clearCfg = () => cfgStore.clear();
export async function cfg<T = unknown>(key: string): Promise<T> {
  const c = cfgStore.get(key);
  if (c && c.exp > Date.now()) return c.v as T;
  const r = await prisma.setting.findUnique({ where: { key } });
  const v = (r ? r.value : null) as T;
  cfgStore.set(key, { v, exp: Date.now() + CFG_TTL });
  return v;
}
export const audit = (actor: number | null, action: string, detail: object = {}) =>
  prisma.auditLog.create({ data: { actor, action, detail } });
export const notify = (db: Tx, userId: number, title: string, body: string, link?: string) =>
  db.notification.create({ data: { userId, title, body, link } });

// ---- ledger: immutable entries, balances derived ----
/**
 * Creates a single immutable ledger entry.
 * The unique constraint on (ref, account) makes this idempotent:
 * a duplicate call with the same ref+account is silently ignored (P2002).
 */
export async function entry(db: Tx, userId: number, account: string, amount: number, kind: string, ref: string) {
  try {
    return await db.ledgerEntry.create({ data: { userId, account, amount, kind, ref } });
  } catch (e: unknown) {
    // P2002 = unique constraint violation → already credited, treat as no-op
    if ((e as { code?: string }).code === 'P2002') return null;
    throw e;
  }
}
export async function move(db: Tx, userId: number, from: string, to: string, amount: number, kind: string, ref: string) {
  await entry(db, userId, from, -amount, kind, ref);
  await entry(db, userId, to, amount, kind, ref);
}
export async function balances(db: Tx, userId: number) {
  const b = { pending: 0, available: 0, held: 0, withdrawn: 0 };
  const rows = await db.ledgerEntry.groupBy({ by: ['account'], where: { userId }, _sum: { amount: true } });
  rows.forEach(r => { (b as Record<string, number>)[r.account] = r._sum.amount ?? 0; });
  const te = await db.ledgerEntry.aggregate({ where: { userId, kind: 'reward' }, _sum: { amount: true } });
  return { total_earned: te._sum.amount ?? 0, ...b };
}
/** Row lock so two simultaneous requests for one user cannot both spend the same balance. */
export const lockUser = (db: Tx, id: number) => db.$queryRaw`SELECT id FROM "User" WHERE id = ${id} FOR UPDATE`;

// ---- Redis-backed cache + rate limiter (falls back to in-process LRU for single-instance dev) ----

/** Lazy Redis client — only imported when REDIS_URL is set. */
let _redis: { get(k: string): Promise<string | null>; set(k: string, v: string, ex: number): Promise<unknown>; incr(k: string): Promise<number>; expire(k: string, s: number): Promise<unknown> } | null = null;
async function redis() {
  if (_redis) return _redis;
  if (!process.env.REDIS_URL) return null;
  try {
    const { createClient } = await import('redis');
    const c = createClient({ url: process.env.REDIS_URL });
    await c.connect();
    _redis = c as unknown as typeof _redis;
    return _redis;
  } catch { return null; }
}

// In-memory LRU fallback (single-instance / dev)
const store = new Map<string, { v: unknown; exp: number }>();
const LRU_MAX = 500;
function lruSet(key: string, v: unknown, ttlMs: number) {
  if (store.size >= LRU_MAX) {
    // evict oldest entry
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
  store.set(key, { v, exp: Date.now() + ttlMs });
}

export async function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const r = await redis();
  if (r) {
    const hit = await r.get('cache:' + key).catch(() => null);
    if (hit) return JSON.parse(hit) as T;
    const v = await fn();
    await r.set('cache:' + key, JSON.stringify(v), ttl).catch(() => {});
    return v;
  }
  const c = store.get(key);
  if (c && c.exp > Date.now()) return c.v as T;
  const v = await fn();
  lruSet(key, v, ttl * 1000);
  return v;
}
export const clearCache = () => {
  store.clear();
  clearCfg();
  // fire-and-forget Redis bust — callers do not need to await this
  void redis().then(r => r?.set('cache:__bust', '1', 1).catch(() => {}));
};

const hits = new Map<string, number[]>();
/**
 * Rate limiter. Key format: `prefix:value` (colon separator prevents collisions).
 * Uses Redis INCR/EXPIRE when available; falls back to in-process Map.
 */
export async function limit(key: string, max: number, ms: number) {
  const r = await redis();
  if (r) {
    const rk = 'rl:' + key;
    const count = await r.incr(rk).catch(() => 0);
    if (count === 1) await r.expire(rk, Math.ceil(ms / 1000)).catch(() => {});
    if (count > max) fail(429, 'Too many attempts. Please wait a few minutes and try again.');
    return;
  }
  const now = Date.now(), a = (hits.get(key) || []).filter(t => now - t < ms);
  a.push(now); hits.set(key, a);
  if (a.length > max) fail(429, 'Too many attempts. Please wait a few minutes and try again.');
}

// ---- one-time email tokens ----
export const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
export async function makeToken(userId: number, kind: string, minutes: number) {
  const raw = crypto.randomBytes(24).toString('hex');
  await prisma.token.create({ data: { userId, kind, hash: sha(raw), expiresAt: new Date(Date.now() + minutes * 60e3) } });
  return raw;
}
export async function useToken(raw: unknown, kind: string) {
  const t = await prisma.token.findUnique({ where: { hash: sha(String(raw)) } });
  if (!t || t.kind !== kind || t.used || t.expiresAt < new Date()) fail(400, 'This link is invalid or has expired.');
  // t is non-null here — fail() throws, so TypeScript needs the assertion
  const token = t!;
  const r = await prisma.token.updateMany({ where: { id: token.id, used: false }, data: { used: true } });
  if (!r.count) fail(400, 'This link is invalid or has expired.');
  return token.userId;
}

// ---- JSON shaping: Prisma camelCase -> snake_case REST contract ----
const snakeKey = (k: string) => (/^[a-z][A-Za-z0-9]*$/.test(k) ? k.replace(/[A-Z]/g, c => '_' + c.toLowerCase()) : k);
export function snake(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(snake);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [snakeKey(k), snake(x)]));
  return v;
}
export const camelKey = (k: string) => k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
export const signedPath = (name: string, ttl = 600) => {
  const exp = Math.floor(Date.now() / 1000) + ttl;
  return `/api/v1/files/${name}?exp=${exp}&sig=${crypto.createHmac('sha256', secret()).update(name + exp).digest('hex')}`;
};

/** Timing-safe string comparison (prevents timing oracle attacks). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
