'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, errMsg } from '@/lib/api';
import { useRequireAuth } from './Providers';
import { Prose } from './bits';

interface L { id: number; title: string; kind: string; minutes: number; preview: boolean }
interface Course { id: number; title: string; lessons: L[] }
interface Full extends L { content: string | null; url: string | null }
interface Prog { done: number[]; completed: boolean }

export default function Learn({ id }: { id: string }) {
  const { me, toast } = useRequireAuth(), router = useRouter(), want = useSearchParams().get('lesson');
  const [c, setC] = useState<Course | null>(null), [p, setP] = useState<Prog | null>(null), [lesson, setLesson] = useState<Full | null>(null), [locked, setLocked] = useState(''), [cert, setCert] = useState<string | null>(null), [busy, setBusy] = useState(false);
  useEffect(() => { if (me) Promise.all([api<Course>('/courses/' + id), api<Prog>(`/courses/${id}/me`)]).then(([a, b]) => { setC(a); setP(b); }).catch(e => toast(errMsg(e))); }, [me?.id, id]); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = c && p ? c.lessons.find(l => String(l.id) === want) || c.lessons.find(l => !p.done.includes(l.id)) || c.lessons[0] : null;
  useEffect(() => { if (!cur) return; setLesson(null); setLocked(''); setCert(null); api<Full>('/lessons/' + cur.id).then(setLesson).catch(e => setLocked(errMsg(e))); }, [cur?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!me || !c || !p) return <div className="wrap"><div className="skel" style={{ height: 300, marginTop: 24 }} /></div>;
  if (!cur) return <div className="wrap"><section><div className="card"><h2>Lessons coming soon</h2><Link className="btn" href="/courses">Back to courses</Link></div></section></div>;
  const idx = c.lessons.indexOf(cur), next = c.lessons[idx + 1], prev = c.lessons[idx - 1], pc = Math.round(p.done.length * 100 / c.lessons.length), isDone = p.done.includes(cur.id);
  const complete = async () => {
    setBusy(true);
    try {
      const r = await api<{ completed: boolean; cert_code: string | null }>(`/lessons/${cur.id}/complete`, { body: {} });
      setP(x => x && { ...x, done: x.done.includes(cur.id) ? x.done : [...x.done, cur.id] });
      if (r.completed && !p.completed) { setCert(r.cert_code); setP(x => x && { ...x, completed: true }); toast('Course complete. Certificate ready.'); }
      else router.push(next ? `/learn/${c.id}?lesson=${next.id}` : `/courses/${c.id}`);
    } catch (e) { toast(errMsg(e)); }
    setBusy(false);
  };
  const body = locked ? <div className="card"><h3>This lesson is for active members</h3><p className="muted">{locked}</p><Link className="btn primary" href="/activate">Activate account</Link></div>
    : !lesson ? <div className="skel" style={{ height: 240 }} />
    : lesson.kind === 'video' ? (!lesson.url ? <p className="muted">Video coming soon.</p> : /\/embed\//.test(lesson.url) ? <iframe className="embed" src={lesson.url} allow="fullscreen" title={lesson.title} /> : <video className="embed" src={lesson.url} controls playsInline preload="metadata" />)
    : lesson.kind === 'pdf' ? (lesson.url ? <><iframe className="pdf" src={lesson.url} title={lesson.title} /><p><a href={lesson.url} target="_blank" rel="noopener noreferrer">Open in a new tab</a></p></> : <p className="muted">eBook coming soon.</p>)
    : <div className="prose"><Prose text={lesson.content || ''} /></div>;
  return <div className="wrap"><section>
    <p><Link href={`/courses/${c.id}`}>← {c.title}</Link></p>
    <div className="player">
      <aside className="card side"><div className="bar-p"><i style={{ width: `${pc}%` }} /></div><small className="muted">{pc}% complete</small>
        <div style={{ marginTop: 8 }}>{c.lessons.map((l, i) => <Link key={l.id} className={`lesson ${l.id === cur.id ? 'on' : ''}`} href={`/learn/${c.id}?lesson=${l.id}`}><span className={`ck ${p.done.includes(l.id) ? 'done' : ''}`}>{p.done.includes(l.id) ? '✓' : ''}</span><span>{i + 1}. {l.title}<br /><small className="muted">{l.minutes} min</small></span></Link>)}</div></aside>
      <div><h1 style={{ fontSize: '1.7rem' }}>{cur.title}</h1>{body}
        {cert && <div className="notice mt"><div><h3>Course complete</h3><span className="muted">Your certificate is ready.</span></div><Link className="btn primary" href={`/certificate/${cert}`}>View certificate</Link></div>}
        {!locked && <div className="row mt">{prev && <Link className="btn" href={`/learn/${c.id}?lesson=${prev.id}`}>Previous</Link>}
          {!cert && <button className="btn primary" disabled={busy} onClick={complete}>{isDone ? (next ? 'Next lesson' : 'Finish') : next ? 'Mark complete and continue' : 'Mark complete'}</button>}</div>}
      </div>
    </div></section></div>;
}
