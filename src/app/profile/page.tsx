'use client';
import { useRef, useState } from 'react';
import { useAuth } from '@/components/Providers';
import { api, errMsg } from '@/lib/api';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ marginBottom: '1.5rem', padding: '28px' }}>
      <h2 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', paddingBottom: '12px', borderBottom: '1px solid var(--line)' }}>{title}</h2>
      {children}
    </div>
  );
}

function Avatar({ url, name, onUpload }: { url?: string | null; name: string; onUpload: (file: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="av-wrap">
      <div className="av-circle" onClick={() => ref.current?.click()} title="Click to change photo">
        {url
          ? <img src={url} alt={name} className="av-img" />
          : <span className="av-initials">{initials}</span>
        }
        <div className="av-overlay">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        </div>
      </div>
      <div>
        <button className="btn sm" onClick={() => ref.current?.click()} type="button">Change photo</button>
        <p className="muted" style={{ fontSize: '.82rem', margin: '6px 0 0' }}>JPG, PNG or WebP · max 5 MB</p>
      </div>
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
    </div>
  );
}

export default function ProfilePage() {
  const { me, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [profile, setProfile] = useState({ full_name: me?.full_name ?? '', phone: me?.phone ?? '' });
  const [pw, setPw] = useState({ current: '', password: '', confirm: '' });
  const [avatarBusy, setAvatarBusy] = useState(false);

  if (!me) return <div className="wrap" style={{ padding: '4rem var(--pad)' }}><p>Please <a href="/login">log in</a> to view your profile.</p></div>;

  const uploadAvatar = async (file: File) => {
    setAvatarBusy(true); setErr(''); setMsg('');
    try {
      await fetch('/api/v1/me/avatar', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': file.type }, body: file })
        .then(r => r.json()).then(d => { if (d.error) throw new Error(d.error); });
      await refresh(); setMsg('Profile photo updated.');
    } catch (x) { setErr(errMsg(x)); }
    setAvatarBusy(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setMsg(''); setBusy(true);
    try { await api('/me', { method: 'PATCH', body: profile }); await refresh(); setMsg('Profile updated.'); }
    catch (x) { setErr(errMsg(x)); } setBusy(false);
  };

  const changePw = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setMsg('');
    if (pw.password !== pw.confirm) { setErr('Passwords do not match.'); return; }
    setBusy(true);
    try { await api('/me/password', { body: { current: pw.current, password: pw.password } }); setMsg('Password changed.'); setPw({ current: '', password: '', confirm: '' }); }
    catch (x) { setErr(errMsg(x)); } setBusy(false);
  };

  return (
    <div className="wrap" style={{ padding: 'clamp(32px,5vw,64px) var(--pad)', maxWidth: 680 }}>
      <h1 style={{ marginBottom: '2rem' }}>My profile</h1>

      {msg && <div className="notice" style={{ marginBottom: '1.5rem' }}>{msg}</div>}
      {err && <p className="err" style={{ marginBottom: '1rem' }}>{err}</p>}

      <Section title="Profile photo">
        {avatarBusy
          ? <p className="muted">Uploading…</p>
          : <Avatar url={(me as any).avatar_url} name={me.full_name} onUpload={uploadAvatar} />
        }
      </Section>

      <Section title="Account info">
        <div className="profile-info">
          <div><span className="muted">Member ID</span><b>{me.member_id}</b></div>
          <div><span className="muted">Username</span><b>@{me.username}</b></div>
          <div><span className="muted">Email</span><b>{me.email} {me.email_verified ? <span className="badge">Verified</span> : <span className="tag" style={{ color: 'var(--red)' }}>Unverified</span>}</b></div>
          <div><span className="muted">Country</span><b>{me.country === 'GH' ? '🇬🇭 Ghana' : '🇳🇬 Nigeria'}</b></div>
          <div><span className="muted">Status</span><b className={me.status === 'activated' ? 'ok' : ''}>{me.status}</b></div>
        </div>
      </Section>

      <Section title="Edit profile">
        <form onSubmit={save} style={{ display: 'grid', gap: '14px' }}>
          <label>Full name
            <input value={profile.full_name} onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))} required minLength={3} />
          </label>
          <label>WhatsApp number
            <input value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} type="tel" required />
          </label>
          <button className="btn primary" type="submit" disabled={busy} style={{ justifySelf: 'start' }}>Save changes</button>
        </form>
      </Section>

      <Section title="Change password">
        <form onSubmit={changePw} style={{ display: 'grid', gap: '14px' }}>
          <label>Current password
            <input type="password" value={pw.current} onChange={e => setPw(p => ({ ...p, current: e.target.value }))} required autoComplete="current-password" />
          </label>
          <label>New password
            <input type="password" value={pw.password} onChange={e => setPw(p => ({ ...p, password: e.target.value }))} required minLength={8} autoComplete="new-password" />
            <small className="muted">At least 8 characters, with a letter and a number.</small>
          </label>
          <label>Confirm new password
            <input type="password" value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} required autoComplete="new-password" />
          </label>
          <button className="btn primary" type="submit" disabled={busy} style={{ justifySelf: 'start' }}>Change password</button>
        </form>
      </Section>
    </div>
  );
}
