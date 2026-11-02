import Link from 'next/link';
import { getCategories, getConfig, getFacts, getRegisteredLearnerCount, listCourses } from '@/server/data';
import { CourseCard, courseCover, Img, Stars } from '@/components/bits';
import VideoHero from '@/components/VideoHero';
import WalkthroughVideo from '@/components/WalkthroughVideo';
import Animate from '@/components/Animate';

export const dynamic = 'force-dynamic';

const Icon = ({ d }: { d: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

function FeaturedCourse({ course }: { course: { id: number; title: string; author: string | null; description: string | null; category: string | null; coverUrl: string | null; level: string; minutes: number; lessons: number; has_free_preview: boolean; rewardEligible: boolean } | undefined }) {
  if (!course) return (
    <div className="lp-hero-learning" aria-label="S Learning course experience">
      <div className="lp-hero-learning-head"><span className="lp-hero-learning-mark"><Icon d="M4 5.5c3.5-1.1 6.8-.5 10 1.5v14c-3.2-2-6.5-2.6-10-1.5v-14Zm16 0c-3.5-1.1-6.8-.5-10 1.5v14c3.2-2 6.5-2.6 10-1.5v-14Z" /></span><b>S Learning</b><span>Learning platform</span></div>
      <div className="lp-hero-learning-body">
        <span className="lp-hero-learning-kicker">YOUR LEARNING JOURNEY</span>
        <h2>Learn at your pace.<br />Build skills that last.</h2>
        <div className="lp-hero-learning-steps">
          <div><b>01</b><span>Choose a course</span></div>
          <div><b>02</b><span>Learn step by step</span></div>
          <div><b>03</b><span>Earn a certificate</span></div>
        </div>
      </div>
    </div>
  );
  return (
    <Link className="lp-hero-featured" href={`/courses/${course.id}`}>
      <div className="lp-hero-featured-art">
        <Img src={course.coverUrl ?? courseCover(course.category)} alt={`Course cover: ${course.title}`} cls="lp-hero-featured-image" eager />
        <div className="lp-hero-featured-art-overlay" aria-hidden="true">
          <span className="lp-hero-art-label">Featured course</span>
          {course.has_free_preview && <span className="lp-hero-art-preview">Preview available</span>}
        </div>
      </div>
      <div className="lp-hero-featured-body">
        <span className="lp-hero-learning-kicker">{course.category || 'POPULAR COURSE'}</span>
        <h2>{course.title}</h2>
        {course.author && <p className="lp-hero-featured-author">By {course.author}</p>}
        {course.description && <p className="lp-hero-featured-description">{course.description}</p>}
        <div className="lp-hero-featured-meta">
          {course.category && <span>{course.category}</span>}
          <span>{course.level}</span>
          <span>{course.lessons} lessons</span>
          <span>{course.minutes} min</span>
          {course.has_free_preview && <span>Free preview</span>}
          {course.rewardEligible && <span>Reward eligible</span>}
        </div>
        <span className="lp-hero-featured-link">Explore course <span aria-hidden="true">→</span></span>
      </div>
    </Link>
  );
}

interface HomepageReview { name: string; country?: string; rating: number; text: string }

function isHomepageReview(value: unknown): value is HomepageReview {
  if (typeof value !== 'object' || value === null) return false;
  const review = value as Record<string, unknown>;
  return typeof review.name === 'string' && !!review.name.trim()
    && (review.country === undefined || typeof review.country === 'string')
    && typeof review.rating === 'number' && review.rating >= 1 && review.rating <= 5
    && typeof review.text === 'string' && !!review.text.trim()
    && !/replace with a genuine learner review/i.test(review.text);
}

export default async function Landing() {
  const [cfg, facts, cats, pop, learnerCount] = await Promise.all([
    getConfig(), getFacts(), getCategories(), listCourses({ sort: 'popular', limit: 4 }), getRegisteredLearnerCount()
  ]);
  const s = cfg.site;
  const reviews = (Array.isArray(cfg.reviews) ? cfg.reviews : []).filter(isHomepageReview);
  const visibleFacts = facts.filter(f => f.title.trim() && f.body.trim() && !/\b(?:replace this|placeholder text)\b/i.test(`${f.title} ${f.body}`));
  const visibleCategories = cats.filter(c => c.count > 0).slice(0, 6);
  const walkthroughUrl = s.walkthrough_video_url || s.video_url;
  const stats = [
    ...(learnerCount > 0 ? [[learnerCount.toLocaleString(), 'Registered learners']] : []),
    ...(pop.total > 0 ? [[pop.total.toLocaleString(), 'Published courses']] : []),
    ...(cfg.countries.length > 0 ? [[String(cfg.countries.length), 'Supported countries']] : []),
    ['Verifiable', 'Course certificates']
  ];

  return (
    <>
      {/* ── HERO ── */}
      <div className="lp-hero-bg">
        <div className="wrap">
          <div className="lp-hero">
            <div className="lp-hero-text">
              <div className="lp-hero-pill fade-up in" style={{ transitionDelay: '40ms' }}>Learning and rewards for Ghana and Nigeria</div>
              <h1 className="lp-h1 fade-up in" style={{ transitionDelay: '80ms' }}>Learn New Skills.<br />Earn Certificates.<br />Build Your Future.</h1>
              <p className="muted lp-sub fade-up in" style={{ transitionDelay: '160ms' }}>
                Practical eBooks and courses with verifiable certificates — plus a reward programme for eligible learners in Ghana and Nigeria.
              </p>
              <form className="lp-search-bar fade-up in" action="/courses" method="get" style={{ transitionDelay: '210ms' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input name="q" type="search" placeholder="Search courses, topics, skills…" aria-label="Search courses" />
                <button className="btn primary" type="submit">Search</button>
              </form>
              <div className="row fade-up in" style={{ transitionDelay: '260ms' }}>
                <Link className="btn primary lp-cta" href="/signup">Start learning</Link>
                <Link className="btn lp-cta-ghost" href="/courses">Browse all courses</Link>
              </div>
              <div className="lp-trust fade-up in" style={{ transitionDelay: '320ms' }}>
                <span>Free preview lessons</span>
                <span>Certificates included</span>
                <span>Reward eligible courses</span>
              </div>
            </div>
            <div className="lp-hero-vid fade-up in" style={{ transitionDelay: '120ms' }}>
              {s.video_url
                ? <VideoHero url={s.video_url} poster={s.video_poster} />
                : <FeaturedCourse course={pop.items[0]} />
              }
            </div>
          </div>
        </div>
      </div>

      {/* ── STATS ── */}
      {stats.length > 0 && <section className="lp-stats-section">
        <div className="wrap">
          <div className="lp-stats">
            {stats.map(([v, l], i) => (
              <div key={l} className="lp-stat-item fade-up in" style={{ transitionDelay: `${i * 80}ms` }}>
                <b>{v}</b><span>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </section>}

      {/* ── POPULAR COURSES ── */}
      {pop.items.length > 0 && <section className="lp-section lp-popular-section">
        <div className="wrap">
          <div className="lp-section-head">
            <Animate>
              <div className="lp-section-label">Trending</div>
              <h2 className="lp-section-title">Popular right now</h2>
            </Animate>
            <Animate><Link href="/courses?sort=popular" className="btn">See more →</Link></Animate>
          </div>
          <div className="grid">
            {pop.items.map((c, i) => (
              <Animate key={c.id} delay={i * 70}><CourseCard c={c} /></Animate>
            ))}
          </div>
        </div>
      </section>}

      {/* ── TRUST STRIP ── */}
      <section className="lp-trust-strip">
        <div className="wrap">
          <p className="lp-trust-strip-label">Designed for practical learning</p>
          <div className="lp-trust-logos">
            {['Mobile-friendly learning', 'Preview lessons on selected courses', 'Verifiable course certificates', 'Rewards on eligible courses', 'Ghana & Nigeria'].map(badge => (
              <span key={badge} className="lp-trust-badge">{badge}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="lp-section" id="how">
        <div className="wrap lp-how-wrap">
          <div className="lp-how-head">
            <Animate><div className="lp-section-label">How it works</div></Animate>
            <Animate delay={60}><h2 className="lp-section-title">Start learning in four steps</h2></Animate>
            <Animate delay={100}><p className="muted lp-section-sub">No experience needed. Sign up today and start your first course in minutes.</p></Animate>
            <Animate delay={160}><Link className="btn primary" href="/signup" style={{ marginTop: '1.5rem', display: 'inline-flex' }}>Create free account →</Link></Animate>
          </div>
          <div className="lp-steps">
            {[
              ['01', 'Register', 'Sign up free with your name, country, and WhatsApp number. No credit card required.'],
              ['02', 'Learn', 'Browse courses, watch lessons, read eBooks, and complete activities at your own pace.'],
              ['03', 'Pass & Certify', 'Complete all lessons and meet the course requirements to earn your certificate.'],
              ['04', 'Earn & Withdraw', 'Eligible learners earn rewards credited to their account, withdrawable via mobile money or bank.'],
            ].map(([num, title, desc], i) => (
              <Animate key={title} delay={i * 80} className="lp-step-card">
                <div className="lp-step-num">{num}</div>
                <h3>{title}</h3>
                <p className="muted" style={{ margin: 0, fontSize: '.95rem' }}>{desc}</p>
              </Animate>
            ))}
          </div>
        </div>
      </section>

      {/* ── SEE HOW IT WORKS (VIDEO) ── */}
      {walkthroughUrl && <section className="lp-section" id="walkthrough">
        <div className="wrap">
          <Animate><div className="lp-section-label">Walkthrough</div></Animate>
          <Animate delay={60}><h2 className="lp-section-title">See how Slearning works</h2></Animate>
          <Animate delay={100}><p className="muted lp-section-sub">A short tour of signing up, learning, earning certificates, and rewards.</p></Animate>
          <div style={{ marginTop: '2rem', maxWidth: '860px', marginInline: 'auto' }}>
            <WalkthroughVideo url={s.walkthrough_video_url || s.video_url} poster={s.walkthrough_poster || s.video_poster} />
          </div>
        </div>
      </section>}

      {/* ── WHY CHOOSE US ── */}
      <section className="lp-section lp-alt" id="why">
        <div className="wrap">
          <Animate><div className="lp-section-label">Why S Learning</div></Animate>
          <Animate delay={60}><h2 className="lp-section-title">Built for African learners</h2></Animate>
          <Animate delay={100}><p className="muted lp-section-sub">Everything you need to grow your skills and earn rewards — designed for Ghana and Nigeria.</p></Animate>
          <div className="lp-features" style={{ marginTop: '2.5rem' }}>
            {[
              ['Certified Learning', 'Complete course requirements to earn a verifiable certificate you can share.', 'M4 4h16v16H4z M8 8h8 M8 12h5 M8 16h3'],
              ['Rewards', 'Eligible learners can earn rewards credited directly to their account.', 'M12 3v18 M17 7.5c0-1.4-2.2-2.5-5-2.5S7 6.1 7 7.5 9.2 10 12 10s5 1.1 5 2.5-2.2 2.5-5 2.5-5-1.1-5-2.5'],
              ['Mobile Learning', 'Learn from your phone with a platform designed for smaller screens.', 'M7 2h10v20H7z M11 18h2'],
              ['Secure Payments', 'Payments and earnings are recorded through your account.', 'M3 6h18v12H3z M3 10h18 M7 15h3'],
              ['Local Payments', 'Payment options include mobile money and bank transfer, depending on your country.', 'M3 10h18 M5 10V6l7-3 7 3v4 M5 10v9 M10 10v9 M14 10v9 M19 10v9 M3 21h18'],
              ['Referral Bonuses', 'Eligible referrals can earn a bonus when they activate their accounts.', 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M20 8v6 M23 11h-6'],
            ].map(([title, desc, icon], i) => (
              <Animate key={title as string} delay={i * 60} className="lp-feature-card">
                <span className="lp-feature-icon"><Icon d={icon as string} /></span>
                <h3>{title}</h3>
                <p className="muted" style={{ margin: 0, fontSize: '.95rem' }}>{desc}</p>
              </Animate>
            ))}
          </div>
        </div>
      </section>

      {/* ── CATEGORIES ── */}
      {visibleCategories.length > 0 && <section className="lp-section lp-alt" id="courses">
        <div className="wrap">
          <div className="lp-section-head">
            <Animate>
              <div className="lp-section-label">Topics</div>
              <h2 className="lp-section-title">Browse by topic</h2>
            </Animate>
            <Animate><Link href="/courses" className="btn">All courses →</Link></Animate>
          </div>
          <div className="grid">
            {visibleCategories.map((c, i) => (
              <Animate key={c.id} delay={i * 60}>
                <Link className="card flat lp-cat-card" href={`/courses?cat=${c.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <Img src={c.thumbUrl} alt={c.name} />
                  <div className="body">
                    <h3>{c.name}</h3>
                    <span className="tag">{c.count} eBooks</span>
                  </div>
                </Link>
              </Animate>
            ))}
          </div>
        </div>
      </section>}

      {/* ── REVIEWS ── */}
      {reviews.length > 0 && <section className="lp-section lp-alt" id="reviews">
        <div className="wrap">
          <Animate><div className="lp-section-label">Testimonials</div></Animate>
          <Animate delay={60}><h2 className="lp-section-title">What learners say</h2></Animate>
          <div className="grid" style={{ marginTop: '2rem' }}>
            {reviews.map((r, i) => (
              <Animate key={i} delay={i * 80} className="lp-review-card">
                <Stars r={r.rating} />
                <p style={{ margin: '12px 0' }}>&ldquo;{r.text}&rdquo;</p>
                <div className="lp-reviewer"><b>{r.name}</b>{r.country && <span className="tag">{r.country}</span>}</div>
              </Animate>
            ))}
          </div>
        </div>
      </section>}

      {/* ── DID YOU KNOW ── */}
      {visibleFacts.length > 0 && <section className="lp-section">
        <div className="wrap">
          <Animate><div className="lp-section-label">Insights</div></Animate>
          <Animate delay={60}><h2 className="lp-section-title">Did you know?</h2></Animate>
          <div className="facts" style={{ marginTop: '2rem' }}>
            {visibleFacts.map((f, i) => (
              <Animate key={f.id} delay={i * 80} style={{ display: 'contents' }}>
                <div className="card flat lp-fact-card">
                  <Img src={f.imageUrl} alt="illustration" />
                  <div className="body">
                    <h3>{f.title}</h3>
                    <p>{f.body}</p>
                    <Link className="btn sm" href={f.linkUrl || '/courses'}>Discover more</Link>
                  </div>
                </div>
              </Animate>
            ))}
          </div>
        </div>
      </section>}

      {/* ── CTA BANNER ── */}
      <section className="lp-cta-section">
        <div className="wrap">
          <Animate className="lp-cta-banner">
            <div>
              <h2 style={{ color: '#fff', margin: '0 0 8px' }}>Ready to start learning?</h2>
              <p style={{ color: 'rgba(255,255,255,.75)', margin: 0 }}>Create an account to explore courses and start learning.</p>
            </div>
            <div className="row">
              <Link className="btn lp-cta-white" href="/signup">Create free account</Link>
              {s.whatsapp_url && <a className="btn lp-cta-outline" target="_blank" rel="noopener noreferrer" href={s.whatsapp_url}>Join WhatsApp</a>}
            </div>
          </Animate>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section className="lp-section" id="contact">
        <div className="wrap">
          <Animate><div className="lp-section-label">Support</div></Animate>
          <Animate delay={60}>
            <h2 className="lp-section-title">Need help?</h2>
            <p className="muted" style={{ marginBottom: '1.5rem' }}>Browse our help pages or reach out directly.</p>
          </Animate>
          <Animate delay={120}>
            <div className="row">
              <Link className="btn primary" href="/faq">Read the FAQ</Link>
              <Link className="btn" href="/p/help">Help centre</Link>
              <Link className="btn" href="/contact">Contact us</Link>
            </div>
          </Animate>
        </div>
      </section>
    </>
  );
}
