'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRequireAuth } from '@/components/Providers';
import { api, errMsg } from '@/lib/api';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card profile-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Avatar({ url, name, onUpload }: { url?: string | null; name: string; onUpload: (file: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="av-wrap">
      <button className="av-circle" type="button" onClick={() => ref.current?.click()} aria-label={`Change ${name}'s profile photo`}>
        {url
          ? <img src={url} alt={name} className="av-img" />
          : <span className="av-initials">{initials}</span>
        }
        <div className="av-overlay">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        </div>
      </button>
      <div>
        <button className="btn sm" onClick={() => ref.current?.click()} type="button">Change photo</button>
        <p className="muted" style={{ fontSize: '.82rem', margin: '6px 0 0' }}>JPG, PNG, WebP or GIF · max 5 MB</p>
      </div>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="profile-file-input" tabIndex={-1} aria-hidden="true" onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
    </div>
  );
}

export default function ProfilePage() {
  const { me, refresh, loading } = useRequireAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [profile, setProfile] = useState({ full_name: me?.full_name ?? '', phone: me?.phone ?? '' });
  const [pw, setPw] = useState({ current: '', password: '', confirm: '' });
  const [avatarBusy, setAvatarBusy] = useState(false);

  useEffect(() => {
    if (me) setProfile({ full_name: me.full_name, phone: me.phone });
  }, [me?.id, me?.full_name, me?.phone]);

  if (loading) return <div className="wrap profile-page"><div className="skel profile-skeleton" /><div className="skel profile-skeleton" /></div>;
  if (!me) return null;

  const uploadAvatar = async (file: File) => {
    setAvatarBusy(true); setErr(''); setMsg('');
    try {
      await fetch('/api/v1/me/avatar', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': file.type }, body: file })
        .then(r => r.json()).then(d => { if (d.error) throw new Error(d.error); });
      await refresh(); setMsg('Profile photo updated.');
    } catch (x) { setErr(errMsg(x)); }
    finally { setAvatarBusy(false); }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setMsg(''); setBusy(true);
    try { await api('/me', { method: 'PATCH', body: profile }); await refresh(); setMsg('Profile updated.'); }
    catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };

  const changePw = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setMsg('');
    if (pw.password !== pw.confirm) { setErr('Passwords do not match.'); return; }
    setBusy(true);
    try { await api('/me/password', { body: { current: pw.current, password: pw.password } }); setMsg('Password changed.'); setPw({ current: '', password: '', confirm: '' }); }
    catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };

  return (
    <div className="wrap profile-page">
      <header className="profile-page-head">
        <div>
          <span className="dash-eyebrow">ACCOUNT</span>
          <h1>My profile</h1>
          <p className="muted">Manage your personal details, account security, and profile photo.</p>
        </div>
        <Link className="btn" href="/dashboard">Back to dashboard</Link>
      </header>

      {msg && <div className="notice profile-feedback" role="status">{msg}</div>}
      {err && <p className="err profile-feedback" role="alert">{err}</p>}

      <div className="profile-grid">
        <Section title="Profile photo">
          {avatarBusy
            ? <p className="muted" role="status">Uploading photo…</p>
            : <Avatar url={me.avatar_url} name={me.full_name} onUpload={uploadAvatar} />
          }
        </Section>

        <Section title="Account info">
          <div className="profile-info">
            <div><span className="muted">Member ID</span><b>{me.member_id}</b></div>
            <div><span className="muted">Username</span><b>@{me.username}</b></div>
            <div><span className="muted">Email</span><span className="profile-value">{me.email} {me.email_verified ? <span className="badge">Verified</span> : <span className="tag profile-unverified">Unverified</span>}</span></div>
            <div><span className="muted">Country</span><b>{me.country === 'GH' ? 'Ghana' : 'Nigeria'}</b></div>
            <div><span className="muted">Account status</span><b className={me.status === 'activated' ? 'ok' : ''}>{me.status === 'activated' ? 'Active' : 'Not activated'}</b></div>
          </div>
        </Section>

        <Section title="Personal details">
          <form onSubmit={save} className="profile-form">
            <label>Full name
              <input value={profile.full_name} onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))} required minLength={3} />
            </label>
            <label>WhatsApp number
              <input value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} type="tel" required />
            </label>
            <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
          </form>
        </Section>

        <Section title="Change password">
          <form onSubmit={changePw} className="profile-form">
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
            <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Updating…' : 'Change password'}</button>
          </form>
        </Section>
      </div>
    </div>
  );
}
