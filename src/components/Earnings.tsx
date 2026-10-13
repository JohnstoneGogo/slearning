'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, when } from '@/lib/api';
import { useAuth } from './Providers';
import { Summary, useFreshMe } from './Money';

function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const ms = new Date(to).getTime() - now; if (ms <= 0) return <div className="cd">Deadline reached</div>;
  const s = Math.floor(ms / 1000), p = (n: number) => String(n).padStart(2, '0');
  return <div className="cd" suppressHydrationWarning>{Math.floor(s / 86400)}d {p(Math.floor((s % 86400) / 3600))}h {p(Math.floor((s % 3600) / 60))}m {p(s % 60)}s</div>;
}
export default function Earnings() {
  const { me, ready, toast } = useFreshMe(), [r, setR] = useState<{ member_id: string; referrer: string | null; count: number } | null>(null);
  useEffect(() => { if (me) api<typeof r>('/me/referrals').then(setR).catch(() => {}); }, [me?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!me || !ready || !r) return <div className="wrap"><div className="skel" style={{ height: 300, marginTop: 24 }} /></div>;
  const link = `${location.origin}/signup?ref=${r.member_id}`;
  const share = () => (navigator.share ? navigator.share({ title: 'S Learning', url: link }).catch(() => {}) : navigator.clipboard.writeText(link).then(() => toast('Referral link copied.')));
  return <div className="wrap"><section>
    <h1 style={{ fontSize: '2rem' }}>Earnings</h1>
    <div className="card"><h3>Referral information</h3><p>My member ID: <b>{r.member_id}</b><br />My referrer&apos;s ID: <b>{r.referrer || 'None'}</b><br />My referral ID: <b>{r.member_id}</b> · Referred so far: <b>{r.count}</b></p>
      <div className="copy"><input readOnly value={link} aria-label="Referral link" /><button className="btn" onClick={() => navigator.clipboard.writeText(link).then(() => toast('Referral link copied.'))}>Copy</button><button className="btn" onClick={share}>Share</button></div></div><br />
    <Summary me={me} /><br />
    <div className="card"><h3>Task deadline</h3><Countdown to={me.deadline_at} /><p className="muted">Deadline: {when(me.deadline_at)}. What happens after expiry is set by platform policy.</p></div>
    <p className="muted mt">Rewards come from eligible referrals and completed reward courses. They start as pending and become available after validation.</p>
    <Link className="btn primary" href="/withdraw">Withdraw</Link>
  </section></div>;
}
