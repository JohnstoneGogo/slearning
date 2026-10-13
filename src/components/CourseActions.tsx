'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, errMsg } from '@/lib/api';
import { useAuth } from './Providers';

interface MeCourse { enrolled: boolean; percent: number; completed: boolean; cert_code: string | null; done: number[]; bookmarked: boolean }

export default function CourseActions({ id, rewardEligible, mode }: { id: number; rewardEligible: boolean; mode: 'hero' | 'side' | 'bar' | 'review' }) {
  const { me, toast } = useAuth(), router = useRouter(), [m, setM] = useState<MeCourse | null>(null), [rv, setRv] = useState({ rating: '5', body: '' }), [err, setErr] = useState('');
  useEffect(() => { if (me) api<MeCourse>(`/courses/${id}/me`).then(setM).catch(() => {}); }, [me, id]);
  const cta = !m?.enrolled ? 'Start learning' : m.completed ? 'Review course' : 'Continue';
  const go = (f: () => Promise<void>) => async () => { if (!me) { toast('Log in to continue.'); router.push('/login'); return; } try { await f(); } catch (e) { toast(errMsg(e)); } };
  const bookmark = go(async () => { const r = await api<{ bookmarked: boolean }>(`/courses/${id}/bookmark`, { body: {} }); setM(x => x && { ...x, bookmarked: r.bookmarked }); });
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setErr(''); try { await api(`/courses/${id}/reviews`, { body: rv }); toast('Thanks for your review.'); router.refresh(); } catch (x) { setErr(errMsg(x)); } };
  if (mode === 'review') return m && m.done.length ? (
    <form className="card mt" onSubmit={submit}><h3>Rate this course</h3>
      <label>Rating<select value={rv.rating} onChange={e => setRv({ ...rv, rating: e.target.value })}>{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{'★'.repeat(n)}</option>)}</select></label>
      <label>Your review<textarea rows={3} maxLength={1000} value={rv.body} onChange={e => setRv({ ...rv, body: e.target.value })} /></label><p className="err">{err}</p><button className="btn primary" type="submit">Post review</button></form>) : null;
  if (mode === 'bar') return <div className="cta-bar noprint"><Link className="btn primary block" href={`/learn/${id}`}>{cta}</Link></div>;
  if (mode === 'side') return (
    <aside className="card noprint"><h3>{rewardEligible ? 'Earn a reward' : 'Earn a certificate'}</h3>
      <p className="muted">{rewardEligible ? 'Finish every lesson to earn a certificate and a reward, if your account is eligible.' : 'Finish every lesson to earn a shareable certificate.'}</p>
      {m?.enrolled && <><div className="bar-p"><i style={{ width: `${m.percent}%` }} /></div><small className="muted">{m.percent}% complete</small></>}
      <Link className="btn primary block mt" href={`/learn/${id}`}>{cta}</Link></aside>);
  return (
    <div className="row mt noprint">
      <Link className="btn primary" href={`/learn/${id}`}>{cta}</Link>
      <button className="btn" style={{ color: '#fff', borderColor: '#fff' }} onClick={bookmark}>{m?.bookmarked ? 'Saved' : 'Save'}</button>
      {m?.cert_code && <Link className="btn" style={{ color: '#fff', borderColor: '#fff' }} href={`/certificate/${m.cert_code}`}>View certificate</Link>}
    </div>
  );
}
