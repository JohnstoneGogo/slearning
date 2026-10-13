import nodemailer from 'nodemailer';

const PROD = process.env.NODE_ENV === 'production';
const tx = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;

/**
 * Sends a plain-text email.
 * In development without SMTP_URL, prints a redacted notice to the console (not the token).
 * In production, SMTP_URL is required — validateEnv() enforces this at startup.
 */
export async function mail(to: string, subject: string, text: string) {
  if (!tx) {
    if (PROD) throw new Error('SMTP_URL is not configured. Cannot send email in production.');
    // L-02: do not log the full body (which contains tokens) — just log the subject
    console.log(`[mail dev] → ${to} | ${subject} | (body omitted — check your SMTP config)`);
    return;
  }
  try {
    await tx.sendMail({ from: process.env.MAIL_FROM || 'S Learning <no-reply@example.com>', to, subject, text });
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', msg: 'mail failed', subject, error: (e as Error).message }));
  }
}
