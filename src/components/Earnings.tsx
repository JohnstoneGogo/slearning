'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, errMsg, when } from '@/lib/api';
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
  const { me, ready, toast } = useFreshMe();
  const [r, setR] = useState<{ member_id: string; referrer: string | null; count: number } | null>(null);
  const [referralError, setReferralError] = useState('');
  const [referralLoading, setReferralLoading] = useState(true);
  useEffect(() => {
    if (!me) return;
    api<{ member_id: string; referrer: string | null; count: number }>('/me/referrals')
      .then(setR)
      .catch(error => setReferralError(errMsg(error)))
      .finally(() => setReferralLoading(false));
  }, [me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const copyLink = useCallback(async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast('Referral link copied.');
    } catch (error) {
      toast(`Could not copy the referral link: ${errMsg(error)}`);
    }
  }, [toast]);

  if (!me || !ready || referralLoading) return <div className="wrap"><div className="skel" style={{ height: 300, marginTop: 24 }} /></div>;
  if (referralError || !r) return <div className="wrap earnings-page"><section><h1>Earnings</h1><div className="notice" role="alert">{referralError || 'Referral information is currently unavailable.'}</div><Link className="btn" href="/dashboard">Back to dashboard</Link></section></div>;
  const link = `${location.origin}/signup?ref=${r.member_id}`;
  const share = async () => {
    if (!navigator.share) return copyLink(link);
    try { await navigator.share({ title: 'S Learning', url: link }); }
    catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') toast(`Could not share the referral link: ${errMsg(error)}`);
    }
  };
  return <div className="wrap earnings-page"><section>
    <header className="earnings-head">
      <div><span className="dash-eyebrow">LEARNER ACCOUNT</span><h1>Earnings</h1><p className="muted">Review your reward balance, referral activity, and withdrawal options.</p></div>
      <Link className="btn" href="/dashboard">Back to dashboard</Link>
    </header>
    <div className="earnings-section">
      <div className="dash-section-head"><div><h2>Reward summary</h2><p className="muted">Balances update as rewards are reviewed and processed.</p></div><Link className="btn primary" href="/withdraw">Withdraw funds</Link></div>
      <Summary me={me} />
    </div>
    <div className="earnings-grid">
      <section className="card earnings-referral">
        <div className="earnings-card-head"><div><span className="dash-eyebrow">INVITE LEARNERS</span><h2>Referral activity</h2></div><span className="earnings-count">{r.count}</span></div>
        <p className="muted">Share your referral link. Eligible rewards are credited after the referral is validated.</p>
        <label className="earnings-label" htmlFor="referral-link">Your referral link</label>
        <div className="copy earnings-copy">
          <input id="referral-link" readOnly value={link} />
          <button className="btn" onClick={() => void copyLink(link)}>Copy</button>
          <button className="btn primary" onClick={() => void share()}>Share</button>
        </div>
        <dl className="earnings-details">
          <div><dt>Member ID</dt><dd>{r.member_id}</dd></div>
          <div><dt>Referred by</dt><dd>{r.referrer || 'No referrer'}</dd></div>
        </dl>
      </section>
      <section className="card earnings-deadline">
        <span className="dash-eyebrow">ACCOUNT</span>
        <h2>Task deadline</h2>
        <Countdown to={me.deadline_at} />
        <p className="muted">Deadline: {when(me.deadline_at)}. What happens after expiry is determined by platform policy.</p>
        <p className="earnings-policy">Rewards come from eligible referrals and completed reward courses. They remain pending until validation.</p>
      </section>
    </div>
  </section></div>;
}
