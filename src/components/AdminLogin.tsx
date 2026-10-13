'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/v1/me', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (u?.role === 'admin') router.replace('/admin'); })
      .catch(() => {});
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const r = await fetch('/api/v1/auth/login', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Login failed');
      if (d.role !== 'admin') throw new Error('Access denied. Admin accounts only.');
      router.replace('/admin');
    } catch (x: any) {
      setErr(x.message);
    }
    setBusy(false);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <form onSubmit={submit} className="card formcard" style={{ width: '100%', maxWidth: 380 }}>
        <h2 style={{ marginBottom: '1.5rem' }}>Admin sign in</h2>
        <label>Username or email
          <input value={identifier} onChange={e => setIdentifier(e.target.value)} required autoComplete="username" autoFocus />
        </label>
        <label>Password
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
        </label>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn primary block" disabled={busy}>Sign in</button>
      </form>
    </div>
  );
}
