'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function CourseSearch({ q, level, sort, cat, access = '', duration = '', language = '', languages = [] }: { q: string; level: string; sort: string; cat: string; access?: string; duration?: string; language?: string; languages?: string[] }) {
  const router = useRouter(), [term, setTerm] = useState(q), [sg, setSg] = useState<{ id: number; title: string }[]>([]), [lv, setLv] = useState(level), [so, setSo] = useState(sort), [dur, setDur] = useState(duration), [lang, setLang] = useState(language);
  useEffect(() => { setTerm(q); setLv(level); setSo(sort); setDur(duration); setLang(language); }, [q, level, sort, duration, language]);
  useEffect(() => { const t = setTimeout(async () => { setSg(term.trim().length < 2 || term === q ? [] : await api<{ id: number; title: string }[]>('/search?q=' + encodeURIComponent(term.trim())).catch(() => [])); }, 200); return () => clearTimeout(t); }, [term, q]);
  const go = (e: React.FormEvent) => { e.preventDefault(); const p = new URLSearchParams(Object.entries({ cat, q: term, level: lv, sort: so, access, duration: dur, language: lang }).filter(x => x[1])); router.push('/courses?' + p); setSg([]); };
  return (
    <form className="row" onSubmit={go}>
      <div className="suggest"><input value={term} onChange={e => setTerm(e.target.value)} placeholder="Search by title, topic or author" autoComplete="off" aria-label="Search courses" />
        {sg.length > 0 && <ul>{sg.map(x => <li key={x.id}><Link href={`/courses/${x.id}`}>{x.title}</Link></li>)}</ul>}</div>
      <select aria-label="Level" value={lv} onChange={e => setLv(e.target.value)} style={{ maxWidth: 170 }}><option value="">All levels</option>{['Beginner', 'Intermediate', 'Advanced'].map(l => <option key={l}>{l}</option>)}</select>
      <select aria-label="Course duration" value={dur} onChange={e => setDur(e.target.value)} style={{ maxWidth: 170 }}>
        <option value="">Any duration</option><option value="short">Under 1 hour</option><option value="medium">1-3 hours</option><option value="long">Over 3 hours</option>
      </select>
      <select aria-label="Course language" value={lang} onChange={e => setLang(e.target.value)} style={{ maxWidth: 170 }}>
        <option value="">Any language</option>{languages.map(l => <option key={l} value={l}>{l}</option>)}
      </select>
      <select aria-label="Sort" value={so} onChange={e => setSo(e.target.value)} style={{ maxWidth: 170 }}><option value="">Most popular</option><option value="newest">Newest</option><option value="rating">Top rated</option></select>
      <button className="btn primary" type="submit">Search</button>
    </form>
  );
}
