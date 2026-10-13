import type { User } from '@prisma/client';
import { APP_URL, HttpError, PROD, snake } from './core';
import { userFrom } from './auth';

export class Res { constructor(public data: unknown, public status = 200, public headers: Record<string, string> = {}) {} }
export interface Ctx {
  req: Request; params: Record<string, string>; query: URLSearchParams; ip: string; user: User | null;
  text(): Promise<string>; json<T = unknown>(): Promise<T>;
}
export type AuthedCtx = Ctx & { user: User };
type Mode = 'none' | 'user' | 'admin';
interface Route { method: string; re: RegExp; keys: string[]; mode: Mode; fn: (c: unknown) => Promise<unknown>; cache: number }
const routes: Route[] = [];

function add(method: string, pattern: string, mode: Mode, fn: (c: unknown) => Promise<unknown>, cache = 0) {
  const keys = [...pattern.matchAll(/:([a-z]+)/gi)].map(m => m[1]);
  routes.push({ method, mode, fn, cache, keys, re: new RegExp('^' + pattern.replace(/:[a-z]+/gi, '([^/]+)') + '/?$') });
}
/** pub = no login needed (optional cache seconds), member = logged-in user, admin = CMS administrator */
export const pub = (m: string, p: string, fn: (c: Ctx) => Promise<unknown>, cache = 0) => add(m, p, 'none', fn as (c: unknown) => Promise<unknown>, cache);
export const member = (m: string, p: string, fn: (c: AuthedCtx) => Promise<unknown>) => add(m, p, 'user', fn as (c: unknown) => Promise<unknown>);
export const admin = (m: string, p: string, fn: (c: AuthedCtx) => Promise<unknown>) => add(m, p, 'admin', fn as (c: unknown) => Promise<unknown>);

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Checks the Origin or Referer header on state-changing requests authenticated
 * by cookie to prevent CSRF. Bearer-token requests (mobile app) are exempt.
 */
function checkOrigin(req: Request): void {
  if (SAFE_METHODS.has(req.method)) return;
  // Only enforce for cookie-authenticated requests
  const cookie = req.headers.get('cookie') || '';
  if (!cookie.includes('sl_token=')) return;
  const origin = req.headers.get('origin') || req.headers.get('referer') || '';
  if (!origin) {
    // No origin header — block in production, allow in dev
    if (PROD) throw new HttpError(403, 'Missing Origin header.');
    return;
  }
  const allowed = APP_URL.replace(/\/$/, '');
  if (!origin.startsWith(allowed)) throw new HttpError(403, 'Cross-origin request blocked.');
}

export async function dispatch(req: Request, segs: string[]): Promise<Response> {
  const path = '/' + segs.join('/'), url = new URL(req.url);
  try {
    checkOrigin(req);
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = r.re.exec(path); if (!m) continue;
      const keys = r.keys;
      const params = Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      let body: string | null = null;
      const ctx: Ctx = {
        req, params, query: url.searchParams, user: null,
        ip: (req.headers.get('x-forwarded-for') || '127.0.0.1').split(',')[0].trim(),
        text: async () => (body ??= await req.text()),
        json: async () => { try { return JSON.parse((await ctx.text()) || '{}'); } catch { throw new HttpError(400, 'Invalid JSON.'); } }
      };
      if (r.mode !== 'none') {
        ctx.user = await userFrom(req);
        if (!ctx.user) throw new HttpError(401, 'Please log in to continue.');
        if (r.mode === 'admin' && ctx.user.role !== 'admin') throw new HttpError(403, 'Admins only.');
      }
      const out = await r.fn(ctx);
      if (out instanceof Response) return out;
      const res = out instanceof Res ? out : new Res(out);
      const cache = r.cache ? `public, max-age=${r.cache}, stale-while-revalidate=${r.cache * 5}` : 'no-store';
      return Response.json(snake(res.data), { status: res.status, headers: { 'Cache-Control': cache, ...res.headers } });
    }
    throw new HttpError(404, 'Not found.');
  } catch (e) {
    if (e instanceof HttpError)
      return Response.json({ error: e.message }, { status: e.status, headers: { 'Cache-Control': 'no-store' } });
    // Structured error log — no stack trace in production
    const msg = e instanceof Error ? e.message : String(e);
    const stack = !PROD && e instanceof Error ? e.stack : undefined;
    console.error(JSON.stringify({ level: 'error', msg, stack, path, method: req.method, ts: new Date().toISOString() }));
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
