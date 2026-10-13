'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, errMsg, money } from '@/lib/api';
import { useAuth } from './Providers';

interface MeCourse { enrolled: boolean; has_access: boolean; price: number | null; currency: string; pending_payment: string | null; percent: number; completed: boolean; cert_code: string | null; done: number[]; bookmarked: boolean }
interface Payment { reference: string; status: string; kind: string; course_id: number | null }

export default function CourseActions({ id, rewardEligible, mode }: { id: number; rewardEligible: boolean; mode: 'hero' | 'side' | 'bar' | 'review' }) {
  const { me, toast } = useAuth(), router = useRouter(), [m, setM] = useState<MeCourse | null>(null), [rv, setRv] = useState({ rating: '5', body: '' }), [err, setErr] = useState(''), [ref, setRef] = useState<string | null>(null);
  useEffect(() => { if (me) api<MeCourse>(`/courses/${id}/me`).then(setM).catch(() => {}); }, [me, id]);
  useEffect(() => {
    if (mode !== 'hero' || typeof window === 'undefined') return;
    const reference = new URLSearchParams(window.location.search).get('reference');
    if (reference) setRef(reference);
  }, [mode]);
  useEffect(() => {
    if (!ref || mode !== 'hero') return;
    let stop = false;
    const poll = async () => {
      const p = await api<Payment>('/payments/' + encodeURIComponent(ref)).catch(() => null);
      if (!p || stop) return;
      if (p.status === 'success' && p.kind === 'course' && p.course_id === id) {
        setM(x => x && { ...x, enrolled: true, has_access: true, pending_payment: null });
        toast('Payment confirmed. Course access is ready.');
        window.history.replaceState(null, '', window.location.pathname);
        setRef(null);
        router.refresh();
      } else if (p.status !== 'pending') {
        setErr('We could not confirm the course payment. Check your payment service or try again.');
        setRef(null);
      }
    };
    const timer = window.setInterval(() => { void poll(); }, 3000);
    void poll();
    return () => { stop = true; window.clearInterval(timer); };
  }, [ref, mode, id, router, toast]);
  const go = (f: () => Promise<void>) => async () => { if (!me) { toast('Log in to continue.'); router.push('/login'); return; } try { await f(); } catch (e) { toast(errMsg(e)); } };
  const bookmark = go(async () => { const r = await api<{ bookmarked: boolean }>(`/courses/${id}/bookmark`, { body: {} }); setM(x => x && { ...x, bookmarked: r.bookmarked }); });
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setErr(''); try { await api(`/courses/${id}/reviews`, { body: rv }); toast('Thanks for your review.'); router.refresh(); } catch (x) { setErr(errMsg(x)); } };
  const startCourse = async () => {
    if (!me) { router.push('/login'); return; }
    if (!m) { setErr('Checking course access. Please try again shortly.'); return; }
    if (m.has_access) { router.push(`/learn/${id}`); return; }
    if (m.price == null) { router.push('/activate'); return; }
    if (!me.email_verified) { setErr('Verify your email address before paying.'); return; }
    setErr('');
    try {
      const result = await api<{ unlocked?: boolean; payment?: Payment; checkout_url?: string }>('/payments/courses/' + id, { body: {} });
      if (result.unlocked) {
        setM({ ...m, enrolled: true, has_access: true, pending_payment: null });
        router.push(`/learn/${id}`);
      } else if (result.checkout_url) location.href = result.checkout_url;
      else if (result.payment) setRef(result.payment.reference);
    } catch (e) { setErr(errMsg(e)); }
  };
  const ctaLabel = !me ? 'Log in to start' : !m ? 'Checking access…'
    : m.has_access ? (m.completed ? 'Review course' : m.enrolled ? 'Continue learning' : 'Start learning')
      : m.price == null ? 'Activate account for access'
        : m.price === 0 ? 'Enroll free' : ref ? 'Checking payment…' : `Buy course · ${money(m.price, m.currency)}`;
  const cta = m?.has_access
    ? <Link id="course-action" className="btn primary" href={`/learn/${id}`}>{ctaLabel}</Link>
    : !me
      ? <Link id="course-action" className="btn primary" href="/login">{ctaLabel}</Link>
      : !m
        ? <button id="course-action" className="btn primary" disabled>{ctaLabel}</button>
        : m.price == null
          ? <Link id="course-action" className="btn primary" href="/activate">{ctaLabel}</Link>
          : <button id="course-action" className="btn primary" onClick={() => void startCourse()} disabled={!!ref}>{ctaLabel}</button>;
  if (mode === 'review') return m && m.done.length ? (
    <form className="card mt" onSubmit={submit}><h3>Rate this course</h3>
      <label>Rating<select value={rv.rating} onChange={e => setRv({ ...rv, rating: e.target.value })}>{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{'★'.repeat(n)}</option>)}</select></label>
      <label>Your review<textarea rows={3} maxLength={1000} value={rv.body} onChange={e => setRv({ ...rv, body: e.target.value })} /></label><p className="err">{err}</p><button className="btn primary" type="submit">Post review</button></form>) : null;
  if (mode === 'bar') return <div className="cta-bar noprint"><a className="btn primary block" href="#course-action">{ctaLabel}</a></div>;
  if (mode === 'side') return (
    <aside className="card noprint"><h3>{rewardEligible ? 'Earn a reward' : 'Earn a certificate'}</h3>
      <p className="muted">{rewardEligible ? 'Finish every lesson to earn a certificate and a reward, if your account is eligible.' : 'Finish every lesson to earn a shareable certificate.'}</p>
      <p className="course-price">{m?.price == null ? 'Price pending admin setup' : m.price === 0 ? 'Free course' : money(m.price, m.currency)}</p>
      {m?.enrolled && <><div className="bar-p"><i style={{ width: `${m.percent}%` }} /></div><small className="muted">{m.percent}% complete</small></>}
      <a className="btn primary block mt" href="#course-action">{ctaLabel}</a></aside>);
  return (
    <div className="row mt noprint">
      {cta}
      <button className="btn" style={{ color: '#fff', borderColor: '#fff' }} onClick={bookmark}>{m?.bookmarked ? 'Saved' : 'Save'}</button>
      {m?.cert_code && <Link className="btn" style={{ color: '#fff', borderColor: '#fff' }} href={`/certificate/${m.cert_code}`}>View certificate</Link>}
    </div>
  );
}
