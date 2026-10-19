'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, errMsg } from '@/lib/api';
import { useAuth } from './Providers';

const COUNTRIES = [
  { code: 'GH', name: 'Ghana', dialCode: '+233' },
  { code: 'NG', name: 'Nigeria', dialCode: '+234' },
] as const;
const DIAL = Object.fromEntries(COUNTRIES.map(country => [country.code, country.dialCode])) as Record<string, string>;
function useForm<T extends Record<string, string>>(init: T) {
  const [v, setV] = useState(init), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const bind = (k: keyof T) => ({ name: String(k), value: v[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV(x => ({ ...x, [k]: e.target.value })) });
  const submit = (fn: (v: T) => Promise<void>) => async (e: React.FormEvent) => { e.preventDefault(); setErr(''); setBusy(true); try { await fn(v); } catch (x) { setErr(errMsg(x)); } setBusy(false); };
  return { v, bind, err, busy, submit };
}
const Shell = ({ children }: { children: React.ReactNode }) => <div className="wrap"><section>{children}</section></div>;

export function LoginForm() {
  const f = useForm({ identifier: '', password: '' }), { refresh } = useAuth(), router = useRouter(), sp = useSearchParams(), [show, setShow] = useState(false);
  return <Shell><form className="card formcard" onSubmit={f.submit(async v => { await api('/auth/login', { body: v }); await refresh(); router.push(sp.get('next') || '/dashboard'); })}>
    <h2>Log in</h2><label>Username or email<input {...f.bind('identifier')} required autoComplete="username" /></label>
    <label>Password<input {...f.bind('password')} type={show ? 'text' : 'password'} required autoComplete="current-password" /></label>
    <label className="row" style={{ fontWeight: 400 }}><input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} style={{ width: 'auto', minHeight: 0 }} /> Show password</label>
    <p className="err" role="alert">{f.err}</p><button className="btn primary block" disabled={f.busy}>Log in</button>
    <p className="muted"><Link href="/forgot">Forgot password?</Link> · New here? <Link href="/signup">Sign up</Link></p></form></Shell>;
}

export function SignupForm() {
  const sp = useSearchParams(), f = useForm({ username: '', full_name: '', email: '', country: 'GH', phone: '', referrer_id: sp.get('ref') || '', password: '', confirm_password: '' }), { refresh } = useAuth(), router = useRouter();
  return <Shell><form className="card formcard" onSubmit={f.submit(async v => {
    let p = v.phone.replace(/[\s-]/g, ''); if (!p.startsWith('+')) p = DIAL[v.country] + p.replace(/^0/, '');
    await api('/auth/register', { body: { ...v, phone: p } }); await refresh(); router.push('/dashboard'); })}>
    <h2>Create your account</h2>
    <label>Username<input {...f.bind('username')} required autoComplete="username" pattern="[A-Za-z0-9_]{3,20}" title="3-20 letters, numbers or underscores" /></label>
    <label>Full name<input {...f.bind('full_name')} required autoComplete="name" /></label>
    <label>Email address<input {...f.bind('email')} type="email" required autoComplete="email" /></label>
    <label>Country<select {...f.bind('country')}>{COUNTRIES.map(country => <option key={country.code} value={country.code}>{country.name}</option>)}</select></label>
    <label>WhatsApp number<span className="phone-field"><span className="phone-dial" aria-label="Country calling code">{DIAL[f.v.country]}</span><input {...f.bind('phone')} type="tel" required placeholder="Phone number" autoComplete="tel-national" /></span></label>
    <label>Referrer ID (optional)<input {...f.bind('referrer_id')} /></label>
    <label>Password<input {...f.bind('password')} type="password" required minLength={8} autoComplete="new-password" /><small className="muted">At least 8 characters, with a letter and a number.</small></label>
    <label>Confirm password<input {...f.bind('confirm_password')} type="password" required autoComplete="new-password" /></label>
    <p className="err" role="alert">{f.err}</p><button className="btn primary block" disabled={f.busy}>Create account</button>
    <p className="muted">Already a member? <Link href="/login">Log in</Link></p></form></Shell>;
}

export function ForgotForm() {
  const f = useForm({ email: '' }), [done, setDone] = useState('');
  return <Shell><form className="card formcard" onSubmit={f.submit(async v => setDone((await api<{ message: string }>('/auth/forgot', { body: v })).message))}>
    <h2>Reset your password</h2>{done ? <><p>{done}</p><Link className="btn" href="/login">Back to log in</Link></> : <>
      <label>Email address<input {...f.bind('email')} type="email" required /></label><p className="err" role="alert">{f.err}</p><button className="btn primary block" disabled={f.busy}>Send reset link</button></>}</form></Shell>;
}

export function ResetForm() {
  const token = useSearchParams().get('token'), f = useForm({ password: '' }), router = useRouter(), { toast } = useAuth();
  return <Shell><form className="card formcard" onSubmit={f.submit(async v => { await api('/auth/reset', { body: { token, password: v.password } }); toast('Password updated. Please log in.'); router.push('/login'); })}>
    <h2>Choose a new password</h2><label>New password<input {...f.bind('password')} type="password" required minLength={8} autoComplete="new-password" /></label>
    <p className="err" role="alert">{f.err}</p><button className="btn primary block" disabled={f.busy}>Save password</button></form></Shell>;
}

export function VerifyEmail() {
  const token = useSearchParams().get('token'), { refresh } = useAuth(), [state, setState] = useState<'wait' | 'ok' | string>('wait');
  useEffect(() => { api('/auth/verify', { body: { token } }).then(() => { setState('ok'); void refresh(); }).catch(e => setState(errMsg(e))); }, [token, refresh]);
  return <Shell><div className="card formcard">{state === 'wait' ? <p>Verifying…</p> : state === 'ok' ? <><h2>Email verified</h2><p>Thanks. Your email address is confirmed.</p><Link className="btn primary" href="/dashboard">Continue</Link></> : <><h2>Link problem</h2><p className="err">{state}</p><Link className="btn" href="/dashboard">Go to dashboard</Link></>}</div></Shell>;
}
