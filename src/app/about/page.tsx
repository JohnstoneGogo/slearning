import Link from "next/link";
import type { Metadata } from "next";
import { getConfig } from "@/server/data";
import Animate from "@/components/Animate";

export const metadata: Metadata = {
  title: "About us",
  description:
    "Who we are, what we do, and how S Learning helps learners in Ghana and Nigeria build practical skills and earn verifiable certificates.",
};

const values = [
  [
    "Practical first",
    "Every course teaches a skill you can use immediately — no filler, no theory for its own sake.",
  ],
  [
    "Trust & transparency",
    "Clear pricing, verifiable certificates, and an earnings ledger you can audit at any time.",
  ],
  [
    "Built for Africa",
    "Local payment methods, mobile-first design, and content relevant to Ghana and Nigeria.",
  ],
  [
    "Learner support",
    "Real people answering real questions — by email, help centre, or WhatsApp.",
  ],
];

const milestones = [
  [
    "Launch",
    "We opened the platform with a small catalogue of practical eBooks and courses.",
  ],
  [
    "Growth",
    "Learners from across Ghana and Nigeria joined to build new skills.",
  ],
  [
    "Today",
    "A growing library, verifiable certificates, and a rewards programme for eligible learners.",
  ],
];

export default async function AboutPage() {
  const s = (await getConfig()).site;
  return (
    <>
      {/* ── INTRO ── */}
      <section className="lp-section">
        <div className="wrap">
          <Animate>
            <div className="lp-section-label">About us</div>
            <h1 className="lp-section-title">Learning that pays you back</h1>
            <p className="muted lp-section-sub">
              {s.name} is a learning and rewards platform for learners in Ghana
              and Nigeria. We bring together practical eBooks and courses,
              verifiable certificates, and a reward programme for eligible
              learners — all built to work on the phone in your pocket.
            </p>
          </Animate>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="lp-stats-section">
        <div className="wrap">
          <div className="lp-stats">
            {[
              [s.stat_learners, "Learners"],
              [s.stat_courses, "Courses & eBooks"],
              ["2", "Countries"],
              ["Available", "Certificate on completion"],
            ].map(([v, l], i) => (
              <div
                key={l}
                className="lp-stat-item fade-up in"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <b>{v}</b>
                <span>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MISSION ── */}
      <section className="lp-section">
        <div className="wrap lp-how-wrap">
          <div className="lp-how-head">
            <Animate>
              <div className="lp-section-label">Our mission</div>
            </Animate>
            <Animate delay={60}>
              <h2 className="lp-section-title">
                Skills today, opportunity tomorrow
              </h2>
            </Animate>
            <Animate delay={100}>
              <p className="muted lp-section-sub">
                Too many people are held back not by ability, but by access — to
                affordable training, to recognised proof of what they can do,
                and to a reason to keep going. We exist to remove those
                barriers. Our goal is simple: make it easy and worthwhile for
                anyone to keep learning.
              </p>
            </Animate>
          </div>
          <div className="lp-steps">
            {milestones.map(([title, desc], i) => (
              <Animate key={title} delay={i * 80} className="lp-step-card">
                <div className="lp-step-num">{`0${i + 1}`}</div>
                <h3>{title}</h3>
                <p className="muted" style={{ margin: 0, fontSize: ".95rem" }}>
                  {desc}
                </p>
              </Animate>
            ))}
          </div>
        </div>
      </section>

      {/* ── VALUES ── */}
      <section className="lp-section lp-alt">
        <div className="wrap">
          <Animate>
            <div className="lp-section-label">What we stand for</div>
          </Animate>
          <Animate delay={60}>
            <h2 className="lp-section-title">Our values</h2>
          </Animate>
          <Animate delay={100}>
            <p className="muted lp-section-sub">
              The principles behind every course, certificate, and payout.
            </p>
          </Animate>
          <div className="lp-features" style={{ marginTop: "2.5rem" }}>
            {values.map(([title, desc], i) => (
              <Animate key={title} delay={i * 60} className="lp-feature-card">
                <h3>{title}</h3>
                <p className="muted" style={{ margin: 0, fontSize: ".95rem" }}>
                  {desc}
                </p>
              </Animate>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="lp-cta-section">
        <div className="wrap">
          <Animate className="lp-cta-banner">
            <div>
              <h2 style={{ color: "#fff", margin: "0 0 8px" }}>
                Ready to start learning?
              </h2>
              <p style={{ color: "rgba(255,255,255,.75)", margin: 0 }}>
                Create an account to explore courses and start learning.
              </p>
            </div>
            <div className="row">
              <Link className="btn lp-cta-white" href="/signup">
                Create free account
              </Link>
              <Link className="btn lp-cta-outline" href="/contact">
                Contact us
              </Link>
            </div>
          </Animate>
        </div>
      </section>
    </>
  );
}
