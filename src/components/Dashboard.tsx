'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, errMsg, type CourseItem, type LearningStats, type UpcomingLearning } from '@/lib/api';
import { useRequireAuth } from './Providers';
import { CourseCard, courseCover, Img } from './bits';
import { Summary, VerifyBanner } from './Money';

function EnrolledCourse({ course }: { course: CourseItem }) {
  const percent = Math.max(0, Math.min(100, course.percent ?? 0));
  return (
    <article className="dash-enrolled-course">
      <Link className="dash-enrolled-thumb" href={`/courses/${course.id}`} aria-label={`Open ${course.title}`}>
        <Img src={course.cover_url ?? courseCover()} alt={`cover of ${course.title}`} />
      </Link>
      <div className="dash-enrolled-info">
        <span className="dash-upcoming-course">ENROLLED COURSE</span>
        <h3><Link href={`/courses/${course.id}`}>{course.title}</Link></h3>
        <span className="muted">{course.level} · {course.minutes} min</span>
      </div>
      <div className="dash-enrolled-progress">
        <div className="bar-p" role="progressbar" aria-label={`${course.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <i style={{ width: `${percent}%` }} />
        </div>
        <span className="muted">{percent}% complete</span>
      </div>
      <Link className="btn sm" href={`/courses/${course.id}`}>Open course</Link>
    </article>
  );
}

export default function Dashboard() {
  const { me } = useRequireAuth(), [mine, setMine] = useState<CourseItem[]>([]), [pop, setPop] = useState<CourseItem[]>([]), [stats, setStats] = useState<LearningStats | null>(null), [upcoming, setUpcoming] = useState<UpcomingLearning[]>([]), [upcomingError, setUpcomingError] = useState(''), [upcomingLoading, setUpcomingLoading] = useState(true);
  useEffect(() => {
    if (me) {
      api<CourseItem[]>('/me/courses').then(setMine).catch(() => {});
      api<{ items: CourseItem[] }>('/courses?sort=popular&limit=4').then(r => setPop(r.items)).catch(() => {});
      api<LearningStats>('/me/learning-stats').then(setStats).catch(() => {});
      api<UpcomingLearning[]>('/me/upcoming')
        .then(setUpcoming)
        .catch(error => setUpcomingError(errMsg(error)))
        .finally(() => setUpcomingLoading(false));
    }
  }, [me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!me) return (
    <div className="wrap">
      <div className="skel" style={{ height: 80, marginTop: 24 }} />
      <div className="dash-skel-grid">
        {[1,2,3,4].map(i => <div key={i} className="skel" style={{ height: 220 }} />)}
      </div>
    </div>
  );

  const active = mine.filter(m => !m.completed_at);
  const completed = mine.filter(m => m.completed_at);
  const certs = mine.filter(m => m.cert_code);
  const streak = Math.min(stats?.current_streak ?? 0, 999);
  const quizPassRate = stats?.quiz_attempts
    ? Math.round((stats.quiz_passed / stats.quiz_attempts) * 100)
    : null;

  return (
    <div className="wrap dash-page">
      <section>
        <VerifyBanner me={me} />

        {/* Activation notice */}
        {me.status !== 'activated' && (
          <div className="notice dash-activation">
            <div>
              <h3 style={{ margin: '0 0 4px' }}>Activate your account</h3>
              <span className="muted">Complete activation to unlock all courses and the reward programme.</span>
            </div>
            <div className="row">
              <Link className="btn primary" href="/activate">Activate now</Link>
              <Link className="btn" href="/faq">Learn more</Link>
            </div>
          </div>
        )}

        <div className="dash-welcome">
          <div>
            <span className="dash-eyebrow">LEARNER DASHBOARD</span>
            <h1 className="dash-greeting">Hello, {me.full_name.split(' ')[0]}</h1>
            <p className="muted" style={{ margin: 0 }}>Your learning activity and account at a glance.</p>
          </div>
          <div className="dash-header-actions">
            <Link className="btn" href="/profile">Profile settings</Link>
            <Link className="btn primary" href="/courses">Browse courses</Link>
          </div>
        </div>

        <section className="dash-overview" aria-labelledby="dash-overview-title">
          <div className="dash-overview-head">
            <div>
              <h2 id="dash-overview-title">Learning overview</h2>
              <p className="muted">A summary of your current progress.</p>
            </div>
            <Link className="dash-overview-link" href="/earnings">View earnings <span aria-hidden="true">→</span></Link>
          </div>
          <div className="dash-quick-stats">
            <div className="dash-qs-item">
              <b>{active.length}</b><span>In progress</span>
            </div>
            <div className="dash-qs-item">
              <b>{completed.length}</b><span>Completed</span>
            </div>
            <div className="dash-qs-item">
              <b>{certs.length}</b><span>Certificates</span>
            </div>
            <div className="dash-qs-item">
              <b>{streak}</b><span>Day streak</span>
            </div>
          </div>
          <div className="dash-learning-stats">
            <div><span>Lessons completed</span><b>{stats?.lessons_done ?? '—'}</b></div>
            <div><span>Quiz pass rate</span><b>{quizPassRate == null ? '—' : `${quizPassRate}%`}</b></div>
            <div><span>Active study days</span><b>{stats?.active_days ?? '—'}</b></div>
          </div>
        </section>

        {/* Continue learning */}
        <div className="dash-section">
            <div className="dash-section-head">
              <div>
                <h2>Continue learning</h2>
                <p className="muted">Pick up where you left off.</p>
              </div>
              {active.length > 0 && <Link href="/courses" className="btn sm">Browse courses</Link>}
            </div>
            {active.length > 0
              ? <div className="dash-enrolled-list">{active.slice(0, 4).map(c => <EnrolledCourse key={c.id} course={c} />)}</div>
              : <div className="dash-empty-state">
                  <div>
                    <h3>No courses in progress</h3>
                    <p className="muted">Explore the catalogue and enrol in a course to start learning.</p>
                  </div>
                  <Link className="btn primary" href="/courses">Explore courses</Link>
                </div>
            }
            {active.length > 0 && (
              <div className="dash-upcoming">
                <div className="dash-upcoming-head">
                  <div>
                    <h3>Up next</h3>
                    <p className="muted">Your next lessons across enrolled courses.</p>
                  </div>
                </div>
                {upcomingLoading
                  ? <p className="dash-upcoming-message muted" role="status">Loading your next lessons…</p>
                  : upcomingError
                  ? <p className="dash-upcoming-message err" role="alert">{upcomingError}</p>
                  : upcoming.length > 0
                    ? <div className="dash-upcoming-list">
                        {upcoming.slice(0, 3).map(item => (
                          <article className="dash-upcoming-item" key={item.course_id}>
                            <div className="dash-upcoming-copy">
                              <span className="dash-upcoming-course">{item.title}</span>
                              {item.next_lesson
                                ? <><b>{item.next_lesson.title}</b><span className="muted">{item.next_lesson.minutes} min · {item.remaining} lesson{item.remaining === 1 ? '' : 's'} remaining</span></>
                                : <span className="muted">No lessons are available yet.</span>
                              }
                              {item.quiz && <span className={`dash-quiz-status${item.quiz.passed ? ' passed' : ''}`}>{item.quiz.passed ? 'Quiz passed' : `Quiz · ${item.quiz.questions} questions · ${item.quiz.pass_percent}% to pass`}</span>}
                            </div>
                            {item.next_lesson && <Link className="btn sm" href={`/learn/${item.course_id}?lesson=${item.next_lesson.id}`}>Continue</Link>}
                          </article>
                        ))}
                      </div>
                    : <p className="dash-upcoming-message muted">You’re all caught up. Choose a course to keep building your skills.</p>
                }
              </div>
            )}
        </div>

        {/* Recommended / popular */}
        {pop.length > 0 && <div className="dash-section">
          <div className="dash-section-head">
            <div>
              <h2>{active.length ? 'Explore more courses' : 'Popular courses'}</h2>
              <p className="muted">Browse more learning options from the catalogue.</p>
            </div>
            <Link href="/courses" className="btn sm">View catalogue</Link>
          </div>
          <div className="grid">{pop.map(c => <CourseCard key={c.id} c={c} />)}</div>
        </div>}

        {/* Earnings summary */}
        <div className="dash-section">
          <div className="dash-section-head">
            <div>
              <h2>Your earnings</h2>
              <p className="muted">Track rewards and available funds.</p>
            </div>
            <Link href="/earnings" className="btn sm">View details</Link>
          </div>
          <Summary me={me} />
        </div>

        {/* Certificates */}
        {certs.length > 0 && (
          <div className="dash-section">
            <div className="dash-section-head">
              <div>
                <h2>Your certificates</h2>
                <p className="muted">Open a certificate to view or verify it.</p>
              </div>
            </div>
            <div className="dash-certs-grid">
              {certs.map(c => (
                <Link key={c.id} className="dash-cert-card" href={`/certificate/${c.cert_code}`}>
                  <div>
                    <b>{c.title}</b>
                    <span className="tag ok" style={{ marginLeft: 8 }}>Completed</span>
                    <p className="muted" style={{ margin: '4px 0 0', fontSize: '.85rem' }}>Certificate ID: {c.cert_code?.slice(0, 12)}…</p>
                  </div>
                  <span className="dash-cert-arrow">→</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Quick links */}
        <nav className="dash-quick-links" aria-label="Account and support links">
          <Link href="/profile" className="dash-ql-item">
            <span>Profile and settings</span><span aria-hidden="true">→</span>
          </Link>
          <Link href="/withdraw" className="dash-ql-item">
            <span>Withdraw earnings</span><span aria-hidden="true">→</span>
          </Link>
          <Link href="/earnings" className="dash-ql-item">
            <span>Payment history</span><span aria-hidden="true">→</span>
          </Link>
          <Link href="/faq" className="dash-ql-item">
            <span>Help and FAQ</span><span aria-hidden="true">→</span>
          </Link>
        </nav>
      </section>
    </div>
  );
}
