'use client';
import { useState } from 'react';

export default function ContactForm({ email }: { email: string }) {
  const [e, setE] = useState({ name: '', email: '', msg: '' });
  const send = (ev: React.FormEvent) => { ev.preventDefault(); location.href = `mailto:${email}?subject=${encodeURIComponent('Support request from ' + e.name)}&body=${encodeURIComponent(e.msg + '\n\n' + e.email)}`; };
  return (
    <form onSubmit={send} className="card">
      <label>Your name<input required value={e.name} onChange={x => setE({ ...e, name: x.target.value })} /></label>
      <label>Email<input type="email" required value={e.email} onChange={x => setE({ ...e, email: x.target.value })} /></label>
      <label>Message<textarea rows={4} required value={e.msg} onChange={x => setE({ ...e, msg: x.target.value })} /></label>
      <button className="btn primary" type="submit">Send message</button>
    </form>
  );
}
