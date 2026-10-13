import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';

// H-10: always redirect to APP_URL, never to the request's Host header
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    // Fail safe: redirect to root rather than using an untrusted Host header
    return NextResponse.redirect(new URL('/', 'http://localhost:3000'));
  }
  const u = new URL(req.url);
  const ref = (u.searchParams.get('reference') || u.searchParams.get('trxref') || '').replace(/[^\w-]/g, '');
  const payment = ref ? await prisma.payment.findUnique({ where: { reference: ref }, select: { kind: true, courseId: true } }) : null;
  const destination = payment?.kind === 'course' && payment.courseId
    ? `/courses/${payment.courseId}?reference=${encodeURIComponent(ref)}`
    : `/activate?reference=${encodeURIComponent(ref)}`;
  return NextResponse.redirect(new URL(destination, appUrl));
}
