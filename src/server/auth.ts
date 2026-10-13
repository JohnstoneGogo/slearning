import { SignJWT, jwtVerify } from 'jose';
import { prisma } from './db';
import { PROD, fail, secret } from './core';
import type { User } from '@prisma/client';

const key = () => new TextEncoder().encode(secret());
export const COOKIE = 'sl_token';

export const signToken = (userId: number, tokenVersion: number) =>
  new SignJWT({ id: userId, tv: tokenVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(key());

export const cookieHeader = (token: string | null) =>
  `${COOKIE}=${token ?? ''}; Path=/; HttpOnly; SameSite=Lax; ${PROD ? 'Secure; ' : ''}Max-Age=${token ? 7 * 86400 : 0}`;

/**
 * Resolves the authenticated user from a request.
 * Accepts an httpOnly cookie (web) or Authorization: Bearer token (mobile app).
 * Validates the token version so password changes and logout-everywhere work.
 */
export async function userFrom(req: Request): Promise<User | null> {
  const bearer = (req.headers.get('authorization') || '').replace('Bearer ', '');
  const cookie = /(?:^|;\s*)sl_token=([^;]+)/.exec(req.headers.get('cookie') || '')?.[1];
  const t = bearer || cookie;
  if (!t) return null;
  try {
    const { payload } = await jwtVerify(t, key());
    const u = await prisma.user.findUnique({ where: { id: Number(payload.id) } });
    if (!u) return null;
    if (u.suspended) fail(403, 'This account is suspended. Contact support.');
    // Token version check: if the stored version is higher, this token was invalidated
    if (typeof payload.tv === 'number' && payload.tv !== u.tokenVersion) return null;
    return u;
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    return null;
  }
}
