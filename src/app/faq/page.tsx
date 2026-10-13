import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Frequently asked questions',
  description: 'Answers about S Learning accounts, courses, certificates, rewards, and payments.',
};

const questions = [
  {
    question: 'Is it free to create an account?',
    answer: 'Yes. Registration is free. Some courses and account features may require account activation; review the current activation fee and terms before paying.',
  },
  {
    question: 'How do I start a course?',
    answer: 'Browse the course catalogue, open a course to review its details and syllabus, then select Start learning. Some lessons are available as free previews; other lessons require an activated account.',
  },
  {
    question: 'How do I earn a certificate?',
    answer: 'Complete every required lesson in a course. When the server confirms course completion, a certificate of completion with a unique verification code becomes available in your dashboard. It confirms completion of that course and is not a claim of external accreditation.',
  },
  {
    question: 'How do rewards and withdrawals work?',
    answer: 'Only rewards recorded and approved by the platform are included in your balance. Eligible available funds may be requested for withdrawal using the methods shown in your account. Fees, limits, verification, and processing times can apply.',
  },
  {
    question: 'Can I refer someone?',
    answer: 'You can share your referral ID during registration. Any referral reward is subject to the platform’s eligibility rules, verification, and current terms.',
  },
  {
    question: 'Which payment methods are supported?',
    answer: 'Available payment methods depend on your country and are shown at checkout. Confirm the amount and currency on the payment screen before approving a transaction.',
  },
  {
    question: 'How can I get help with my account or a payment?',
    answer: 'Visit the Help Centre for guidance or contact support with the email address on your account and relevant payment reference. Do not send your password or full payment-card details.',
  },
];

export default function FaqPage() {
  return (
    <div className="wrap faq-page">
      <div className="lp-section-label">Help &amp; support</div>
      <h1 className="lp-section-title">Frequently asked questions</h1>
      <p className="muted faq-intro">
        Find answers about getting started, courses, certificates, rewards, and payments.
      </p>
      <div className="lp-faq-wrap">
        {questions.map(({ question, answer }) => (
          <details className="lp-details" key={question}>
            <summary>{question}</summary>
            <p className="muted faq-answer">{answer}</p>
          </details>
        ))}
      </div>
      <div className="faq-contact">
        <h2>Still need help?</h2>
        <p className="muted">Browse the Help Centre or send a message to our support team.</p>
        <div className="row">
          <Link className="btn" href="/p/help">Help Centre</Link>
          <Link className="btn primary" href="/contact">Contact us</Link>
        </div>
      </div>
    </div>
  );
}
