import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getCourse, getReviews } from '@/server/data';
import { Img, Stars } from '@/components/bits';
import CourseActions from '@/components/CourseActions';

export const dynamic = 'force-dynamic';
const load = async (id: string) => { try { return await getCourse(+id); } catch { return null; } };
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> { const c = await load((await params).id); return { title: c?.title ?? 'Course', description: c?.description?.slice(0, 160) }; }

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const c = await load((await params).id); if (!c) notFound();
  const course = c!, reviews = await getReviews(course.id);
  const isFree = course.is_free;

  return (
    <>
      {/* ── COURSE HERO ── */}
      <div className="courseh">
        <div className="wrap">
          <p style={{ marginBottom: '1rem' }}>
            <Link href={`/courses?cat=${course.categoryId ?? ''}`} style={{ color: '#c9d6ea', fontSize: '.9rem' }}>
              ← {course.category || 'Courses'}
            </Link>
          </p>
          <div className="two">
            <div>
              <div className="row" style={{ marginBottom: '12px', gap: '8px' }}>
                {isFree
                  ? <span className="course-badge free">Free</span>
                  : <span className="course-badge paid">Paid</span>}
                {course.rewardEligible && <span className="course-badge reward">💰 Reward eligible</span>}
                <span className="course-badge cert">🎓 Certificate</span>
              </div>
              <h1 style={{ fontSize: 'clamp(1.7rem,4.5vw,2.6rem)', marginBottom: '.5rem' }}>{course.title}</h1>
              <p className="sub" style={{ fontSize: '1.05rem', marginBottom: '1rem' }}>{course.description}</p>
              <div className="row" style={{ gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
                {course.ratingCount > 0 && (
                  <span><Stars r={course.rating} /> <b>{course.rating.toFixed(1)}</b> <span className="sub">({course.ratingCount} reviews)</span></span>
                )}
                <span className="sub">👥 {course.enrolments} learners</span>
                <span className="sub">By <b style={{ color: '#fff' }}>{course.author || 'Unknown'}</b></span>
              </div>
              <div className="row" style={{ gap: '8px', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                <span className="tag">{course.level}</span>
                <span className="tag">⏱ {course.minutes} min</span>
                <span className="tag">📖 {course.lessons.length} lessons</span>
                <span className="tag">{course.language}</span>
              </div>
              <CourseActions id={course.id} rewardEligible={course.rewardEligible} mode="hero" />
            </div>
            <div><Img src={course.coverUrl} alt={`cover of ${course.title}`} cls="cover" eager full /></div>
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="wrap">
        <section>
          <div className="two">
            <div>
              {/* What you'll learn */}
              {course.learn_points.length > 0 && (
                <div className="card course-outcomes">
                  <h2>What you&apos;ll learn</h2>
                  <ul className="checks">{course.learn_points.map((p, i) => <li key={i}>{p}</li>)}</ul>
                </div>
              )}

              {/* Skills */}
              {course.skills.length > 0 && (
                <div style={{ marginTop: '1.5rem' }}>
                  <h3>Skills you&apos;ll gain</h3>
                  <div style={{ marginTop: '8px' }}>{course.skills.map(s => <span className="tag" key={s}>{s}</span>)}</div>
                </div>
              )}

              {/* Certificate requirements */}
              <div className="card course-cert-req">
                <div className="course-cert-icon">🎓</div>
                <div>
                  <h3 style={{ margin: '0 0 6px' }}>Certificate of completion</h3>
                  <p className="muted" style={{ margin: 0, fontSize: '.95rem' }}>
                    Complete all {course.lessons.length} lessons to earn a verifiable certificate. Your certificate includes a unique ID that employers can verify online.
                  </p>
                </div>
              </div>

              {/* Syllabus */}
              <h2 className="mt">Course syllabus</h2>
              <p className="muted" style={{ marginBottom: '1rem', fontSize: '.9rem' }}>{course.lessons.length} lessons · {course.minutes} min total</p>
              {course.lessons.map((l, i) => (
                <details key={l.id} className="course-lesson-detail">
                  <summary>
                    <span className="course-lesson-num">{i + 1}</span>
                    <span>{l.title}</span>
                    <span className="course-lesson-meta">
                      {l.preview && <span className="badge" style={{ marginRight: 6 }}>Free preview</span>}
                      <span className="muted" style={{ fontSize: '.85rem' }}>
                        {({ text: '📄 Reading', video: '▶ Video', pdf: '📕 PDF' } as Record<string, string>)[l.kind] || 'Lesson'} · {l.minutes} min
                      </span>
                    </span>
                  </summary>
                </details>
              ))}
              {!course.lessons.length && <p className="muted">Lessons are coming soon.</p>}

              {/* Reviews */}
              <h2 className="mt">Learner reviews</h2>
              {reviews.length
                ? reviews.map((r, i) => (
                  <div className="card course-review" key={i}>
                    <div className="course-review-head">
                      <div className="course-review-avatar">{r.name?.[0]?.toUpperCase() || '?'}</div>
                      <div><b>{r.name}</b> <span className="tag" style={{ marginLeft: 4 }}>{r.country}</span></div>
                      <Stars r={r.rating} />
                    </div>
                    <p style={{ margin: '10px 0 0' }}>{r.body}</p>
                  </div>
                ))
                : <p className="muted">No reviews yet. Be the first to review after completing the course.</p>}
              <CourseActions id={course.id} rewardEligible={course.rewardEligible} mode="review" />
            </div>

            {/* Sticky sidebar */}
            <CourseActions id={course.id} rewardEligible={course.rewardEligible} mode="side" />
          </div>
        </section>
      </div>

      {/* Mobile CTA bar */}
      <CourseActions id={course.id} rewardEligible={course.rewardEligible} mode="bar" />
    </>
  );
}
