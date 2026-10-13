import { NextResponse } from 'next/server';

// H-10: always redirect to APP_URL, never to the request's Host header
export function GET(req: Request) {
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    // Fail safe: redirect to root rather than using an untrusted Host header
    return NextResponse.redirect(new URL('/', 'http://localhost:3000'));
  }
  const u = new URL(req.url);
  const ref = (u.searchParams.get('reference') || u.searchParams.get('trxref') || '').replace(/[^\w-]/g, '');
  return NextResponse.redirect(new URL(`/activate?reference=${ref}`, appUrl));
}
