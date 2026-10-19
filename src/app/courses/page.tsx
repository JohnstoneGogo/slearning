import Link from 'next/link';
import type { Metadata } from 'next';
import { getCategories, getCourseLanguages, listCourses } from '@/server/data';
import { CourseCard } from '@/components/bits';
import CourseSearch from '@/components/CourseSearch';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Courses' };
const PAGE = 12;

export default async function Courses({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams, cat = sp.cat || '', q = sp.q || '', level = sp.level || '', sort = sp.sort || '', access = sp.access || '', duration = sp.duration || '', language = sp.language || '';
  const parsedPage = Number(sp.page || 1), page = Number.isFinite(parsedPage) ? Math.max(Math.trunc(parsedPage), 1) : 1;
  const filtered = !!(cat || q || level || sort || access || duration || language);
  const [cats, languages, res] = await Promise.all([
    getCategories(),
    getCourseLanguages(),
    listCourses({ category: cat, q, level, sort: sort || (filtered ? 'newest' : 'popular'), access, duration, language, limit: PAGE, offset: (page - 1) * PAGE }),
  ]);
  const href = (o: Record<string, string | number>) => '/courses?' + new URLSearchParams(Object.entries({ cat, q, level, sort, access, duration, language, page: '', ...o }).filter(e => e[1]).map(([k, v]) => [k, String(v)]));

  return (
    <>
      {/* Page header */}
      <div className="courses-hero">
        <div className="wrap">
          <div className="lp-section-label">All courses</div>
          <h1 className="courses-hero-title">Find your next skill</h1>
          <p className="muted" style={{ fontSize: '1.05rem', margin: '8px 0 24px', maxWidth: '52ch' }}>
            Browse practical courses with completion certificates. Filter by topic, level, duration, language, or access.
          </p>
          <CourseSearch q={q} level={level} sort={sort} cat={cat} access={access} duration={duration} language={language} languages={languages} />
        </div>
      </div>

      <div className="wrap">
        <div className="chips course-formats mt" role="group" aria-label="Course format">
          <span className="chip on" aria-current="page">eBook courses</span>
          <span className="chip format-unavailable" aria-disabled="true">Video courses <small>Coming soon</small></span>
        </div>

        {/* Access filter: free previews vs courses that need activation */}
        <div className="chips mt">
          <Link className={`chip ${access ? '' : 'on'}`} href={href({ access: '', page: '' })}>All access</Link>
          <Link className={`chip ${access === 'free' ? 'on' : ''}`} href={href({ access: 'free', page: '' })}>Free preview</Link>
          <Link className={`chip ${access === 'paid' ? 'on' : ''}`} href={href({ access: 'paid', page: '' })}>Members only</Link>
        </div>

        {/* Category chips */}
        <div className="chips">
          <Link className={`chip ${cat ? '' : 'on'}`} href={href({ cat: '', page: '' })}>All topics</Link>
          {cats.map(c => (
            <Link key={c.id} className={`chip ${cat === String(c.id) ? 'on' : ''}`} href={href({ cat: c.id, page: '' })}>
              {c.name} <small>({c.count})</small>
            </Link>
          ))}
        </div>

        {/* Results header */}
        <div className="courses-results-head">
          <h2>{filtered ? `${res.total} result${res.total === 1 ? '' : 's'}` : 'Popular courses'}</h2>
          {filtered && <Link href="/courses" className="btn sm">Clear filters</Link>}
        </div>

        {/* Grid */}
        {res.items.length
          ? <div className="grid">{res.items.map(c => <CourseCard key={c.id} c={c} />)}</div>
          : (
            <div className="card courses-empty">
              <div className="courses-empty-icon">📚</div>
              <h3>No courses found</h3>
              <p className="muted">Try a different category or search term, or check back soon for new content.</p>
              <Link className="btn primary" href="/courses">Browse all courses</Link>
            </div>
          )}

        {/* Pagination */}
        {(page > 1 || page * PAGE < res.total) && (
          <div className="courses-pagination">
            {page > 1 && <Link className="btn" href={href({ page: page - 1 })}>← Previous</Link>}
            <span className="muted" style={{ fontSize: '.9rem' }}>Page {page}</span>
            {page * PAGE < res.total && <Link className="btn" href={href({ page: page + 1 })}>Next →</Link>}
          </div>
        )}
      </div>
    </>
  );
}
