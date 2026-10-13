import Link from 'next/link';
import { getConfig } from '@/server/data';
import { LogoMark } from './Logo';

export default async function Footer() {
  const s = (await getConfig()).site;
  const year = new Date().getFullYear();
  return (
    <footer className="ft">
      <div className="wrap">
        <div className="ft-grid">

          {/* Brand */}
          <div className="ft-brand">
            <Link href="/" className="brand ft-logo" aria-label={s.name}>
              <LogoMark /><span>{s.name}</span>
            </Link>
            <p className="muted ft-tagline">{s.tagline}</p>
            {s.whatsapp_url && (
              <a className="btn sm ft-wa" href={s.whatsapp_url} target="_blank" rel="noopener noreferrer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.859L.057 23.428a.75.75 0 0 0 .916.916l5.569-1.476A11.953 11.953 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.7-.505-5.25-1.385l-.372-.217-3.865 1.024 1.024-3.742-.234-.386A9.956 9.956 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                WhatsApp channel
              </a>
            )}
          </div>

          {/* Learn */}
          <div>
            <h3 className="ft-heading">Learn</h3>
            <ul className="ft-links">
              <li><Link href="/courses">All courses</Link></li>
              <li><Link href="/courses?sort=popular">Popular</Link></li>
              <li><Link href="/courses?sort=rating">Top rated</Link></li>
              <li><Link href="/signup">Create account</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="ft-heading">Company</h3>
            <ul className="ft-links">
              <li><Link href="/about">About us</Link></li>
              <li><Link href="/faq">FAQs</Link></li>
              <li><Link href="/p/help">Help centre</Link></li>
              <li><Link href="/contact">Contact us</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="ft-heading">Legal</h3>
            <ul className="ft-links">
              <li><Link href="/p/terms">Terms &amp; conditions</Link></li>
              <li><Link href="/p/privacy">Privacy policy</Link></li>
              <li><Link href="/p/refund">Refund policy</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="ft-heading">Contact</h3>
            <address className="ft-address">
              <p>{s.address}</p>
              <p><a href={`mailto:${s.support_email}`}>{s.support_email}</a></p>
              <p>{s.phone}</p>
              <p className="muted" style={{ fontSize: '.85rem' }}>{s.hours}</p>
            </address>
          </div>

        </div>

        <div className="ft-bottom">
          <small className="muted">© {year} {s.name}. Rewards are subject to eligibility and verification. Withdrawal times depend on payment providers.</small>
          <div className="ft-legal-links">
            <Link href="/p/terms">Terms</Link>
            <Link href="/p/privacy">Privacy</Link>
            <Link href="/p/refund">Refund</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
