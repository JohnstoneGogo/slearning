import { notFound } from 'next/navigation';
import { getCertificate, getConfig } from '@/server/data';
import PrintButton from '@/components/PrintButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Certificate' };

export default async function Certificate({ params }: { params: Promise<{ code: string }> }) {
  const c = await getCertificate((await params).code).catch(() => null); if (!c) notFound();
  const site = (await getConfig()).site, base = process.env.APP_URL || '';
  return (
    <div className="wrap"><section>
      <div className="cert"><p className="muted">{site.name}</p><h1>Certificate of completion</h1><p>This certifies that</p>
        <h2 style={{ fontSize: 'clamp(1.5rem,5vw,2.4rem)' }}>{c!.fullName}</h2><p>has successfully completed</p><h3 style={{ fontSize: '1.4rem' }}>{c!.title}</h3>
        <p className="muted">{c!.completedAt?.toLocaleDateString('en', { dateStyle: 'long' })}</p><small className="muted">Verification code: {c!.certCode} · {base}/certificate/{c!.certCode}</small></div>
      <p className="center mt noprint"><PrintButton /></p>
    </section></div>
  );
}
