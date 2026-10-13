'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, type CourseItem, type LearningStats } from '@/lib/api';
import { useRequireAuth } from './Providers';
import { CourseCard } from './bits';
import { Summary, VerifyBanner } from './Money';

export default function Dashboard() {
  const { me } = useRequireAuth(), [mine, setMine] = useState<CourseItem[]>([]), [pop, setPop] = useState<CourseItem[]>([]), [stats, setStats] = useState<LearningStats | null>(null);
  useEffect(() => {
    if (me) {
      api<CourseItem[]>('/me/courses').then(setMine).catch(() => {});
      api<{ items: CourseItem[] }>('/courses?sort=popular&limit=4').then(r => setPop(r.items)).catch(() => {});
      api<LearningStats>('/me/learning-stats').then(setStats).catch(() => {});
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

  return (
    <div className="wrap">
      <section>
        <VerifyBanner me={me} />

        {/* Activation notice */}
        {me.status !== 'activated' && (
          <div className="notice">
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

        {/* Welcome + quick stats */}
        <div className="dash-welcome">
          <div>
            <h1 className="dash-greeting">Hello, {me.full_name.split(' ')[0]}</h1>
            <p className="muted" style={{ margin: 0 }}>Welcome back. Keep up the great work!</p>
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
            {streak > 0 && (
              <div className="dash-qs-item dash-streak">
                <b>{streak}</b><span>Day streak</span>
              </div>
            )}
          </div>
        </div>

        {/* Continue learning */}
        {active.length > 0 && (
          <div className="dash-section">
            <div className="dash-section-head">
              <h2>Continue learning</h2>
              <Link href="/courses" className="btn sm">Browse more</Link>
            </div>
            <div className="grid">{active.slice(0, 4).map(c => <CourseCard key={c.id} c={c} />)}</div>
          </div>
        )}

        {/* Recommended / popular */}
        <div className="dash-section">
          <div className="dash-section-head">
            <h2>{active.length ? 'Recommended for you' : 'Start with a popular course'}</h2>
            <Link href="/courses" className="btn sm">See all</Link>
          </div>
          <div className="grid">{pop.map(c => <CourseCard key={c.id} c={c} />)}</div>
        </div>

        {/* Earnings summary */}
        <div className="dash-section">
          <div className="dash-section-head">
            <h2>Your earnings</h2>
            <Link href="/earnings" className="btn sm">View details</Link>
          </div>
          <Summary me={me} />
        </div>

        {/* Certificates */}
        {certs.length > 0 && (
          <div className="dash-section">
            <div className="dash-section-head">
              <h2>Your certificates</h2>
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
        <div className="dash-quick-links">
          <Link href="/profile" className="dash-ql-item">
            <span>Profile &amp; settings</span>
          </Link>
          <Link href="/withdraw" className="dash-ql-item">
            <span>Withdraw earnings</span>
          </Link>
          <Link href="/earnings" className="dash-ql-item">
            <span>Payment history</span>
          </Link>
          <Link href="/faq" className="dash-ql-item">
            <span>Help &amp; FAQ</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
