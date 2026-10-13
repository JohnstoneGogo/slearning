import { getConfig } from '@/server/data';
import ContactForm from '@/components/ContactForm';
import Animate from '@/components/Animate';

export const metadata = { title: 'Contact us' };

export default async function ContactPage() {
  const s = (await getConfig()).site;
  return (
    <div className="wrap" style={{ padding: 'clamp(40px,6vw,80px) var(--pad)' }}>
      <Animate>
        <div className="lp-section-label">Support</div>
        <h1 className="lp-section-title" style={{ marginBottom: '0.25em' }}>Contact us</h1>
        <p className="muted" style={{ marginBottom: '2.5rem', maxWidth: '48ch' }}>
          Have a question or need help? Fill in the form and we&apos;ll get back to you.
        </p>
      </Animate>
      <div className="lp-contact-grid">
        <Animate>
          <div className="card" style={{ padding: '28px' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Get in touch</h2>
            <p className="muted">{s.address}</p>
            <p className="muted" style={{ margin: 0 }}>
              <a href={`mailto:${s.support_email}`}>{s.support_email}</a><br />
              {s.phone}<br />
              {s.hours}
            </p>
            {s.whatsapp_url && (
              <a
                className="btn primary"
                href={s.whatsapp_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ marginTop: '1.5rem' }}
              >
                Join our WhatsApp channel
              </a>
            )}
          </div>
        </Animate>
        <Animate delay={100}>
          <ContactForm email={s.support_email} />
        </Animate>
      </div>
    </div>
  );
}
