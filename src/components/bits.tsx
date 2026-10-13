import Link from 'next/link';
import { imgSrc } from '@/lib/ui';
import type { CourseItem } from '@/lib/api';

export const Stars = ({ r }: { r: number }) => <span className="stars" aria-label={`${(+r || 0).toFixed(1)} out of 5`}>{'★'.repeat(Math.round(r || 0))}{'☆'.repeat(5 - Math.round(r || 0))}</span>;

export function Img({ src, alt, cls = '', eager = false, full = false }: { src?: string | null; alt: string; cls?: string; eager?: boolean; full?: boolean }) {
  const s = imgSrc(src, full);
  if (!s) return (
    <div className={`ph ${cls}`} role="img" aria-label={alt}>
      <svg className="ph-symbol" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path d="M8 11.5c5.7-1.8 11.1-.9 16 2.5v23c-4.9-3.4-10.3-4.3-16-2.5v-23ZM40 11.5c-5.7-1.8-11.1-.9-16 2.5v23c4.9-3.4 10.3-4.3 16-2.5v-23Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M13 18c2.8-.5 5.3-.1 7.5 1.1M13 23c2.8-.5 5.3-.1 7.5 1.1M28 19.1c2.2-1.2 4.7-1.6 7.5-1.1M28 24.1c2.2-1.2 4.7-1.6 7.5-1.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="ph-title">{alt.replace(/^cover of\s+/i, '')}</span>
      <span className="ph-caption">S Learning</span>
    </div>
  );
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={`thumb ${cls}`} src={s.src} srcSet={s.srcSet} sizes={full ? '(max-width:900px) 100vw, 600px' : '(max-width:600px) 100vw, 360px'} alt={alt} width={480} height={300} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : undefined} decoding="async" />;
}

export function CourseCard({ c }: { c: CourseItem }) {
  return (
    <Link className="card flat" href={`/courses/${c.id}`} style={{ textDecoration: 'none' }}>
      <Img src={c.cover_url} alt={`cover of ${c.title}`} />
      <div className="body">
        <h3>{c.title}</h3><p className="muted" style={{ margin: '0 0 6px' }}>{c.author}</p>
        {c.rating_count > 0 && <><Stars r={c.rating} /> <small className="muted">({c.rating_count})</small><br /></>}
        <div className="card-tags">
          {c.has_free_preview ? <span className="tag ok">Free preview</span> : <span className="tag paid-tag">Paid</span>}
          <span className="tag cert-tag">Certificate</span>
          <span className="tag">{c.level}</span><span className="tag">{c.minutes} min</span>
          {!!c.quiz_count && <span className="tag">{c.quiz_count} quiz{c.quiz_count === 1 ? '' : 'zes'}</span>}
          {c.reward_eligible && <span className="tag ok">Reward</span>}
        </div>
        {c.percent != null && <><div className="bar-p" style={{ marginTop: 8 }}><i style={{ width: `${c.percent}%` }} /></div><small className="muted">{c.percent}% complete</small></>}
      </div>
    </Link>
  );
}
/** Safe mini-markdown: paragraphs and **bold** only. Text is rendered by React, so it is escaped automatically. */
export function Prose({ text }: { text: string }) {
  return <>{text.split(/\n{2,}/).map((p, i) => <p key={i}>{p.split('\n').map((line, j) => <span key={j}>{j > 0 && <br />}{line.split(/(\*\*.+?\*\*)/g).map((t, k) => (/^\*\*.+\*\*$/.test(t) ? <b key={k}>{t.slice(2, -2)}</b> : t))}</span>)}</p>)}</>;
}
