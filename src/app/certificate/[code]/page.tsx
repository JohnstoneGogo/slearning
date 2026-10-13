import { notFound } from 'next/navigation';
import { getCertificate, getConfig } from '@/server/data';
import PrintButton from '@/components/PrintButton';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Certificate' };

export default async function Certificate({ params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code;
  const c = await getCertificate(code).catch(() => null); if (!c) notFound();
  const site = (await getConfig()).site, verifyUrl = `/certificate/${encodeURIComponent(code)}`;
  return (
    <div className="wrap certificate-page"><section>
      <div className="cert">
        <div className="cert-brand">{site.name}</div>
        <span className="cert-status"><span aria-hidden="true">✓</span> Verified certificate</span>
        <p className="cert-kicker">CERTIFICATE OF COMPLETION</p>
        <h1>This certifies that</h1>
        <h2 className="cert-learner">{c!.fullName}</h2>
        <p className="cert-copy">has successfully completed the course</p>
        <h3 className="cert-course">{c!.title}</h3>
        <div className="cert-date">
          <span>Completion date</span>
          <b>{c!.completedAt?.toLocaleDateString('en', { dateStyle: 'long' }) || 'Date unavailable'}</b>
        </div>
        <div className="cert-verification">
          <span>Certificate ID</span>
          <code>{c!.certCode}</code>
          <Link href={verifyUrl}>Verify this certificate online</Link>
        </div>
      </div>
      <div className="certificate-actions noprint">
        <Link className="btn" href="/dashboard">Back to dashboard</Link>
        <PrintButton />
      </div>
    </section></div>
  );
}
