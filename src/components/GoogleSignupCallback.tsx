'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api, errMsg } from '@/lib/api';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { useAuth } from './Providers';

const DIAL: Record<string, string> = { GH: '+233', NG: '+234' };
interface GoogleProfile { email: string; full_name: string; avatar_url: string | null }
interface GoogleSignupProfile { profile: GoogleProfile; accessToken: string; referrerId: string }

function safeNext(value: string | null) {
  return value?.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : '/dashboard';
}

export default function GoogleSignupCallback() {
  const search = useSearchParams();
  const nextPath = search.get('next');
  const nextReferrer = search.get('ref') || '';
  const oauthError = search.get('error_description') || search.get('error');
  const router = useRouter();
  const { refresh } = useAuth();
  const signInAttempt = useRef<Promise<GoogleSignupProfile | null> | null>(null);
  const [profile, setProfile] = useState<GoogleProfile | null>(null);
  const [accessToken, setAccessToken] = useState('');
  const [country, setCountry] = useState('GH');
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [referrerId, setReferrerId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const finishSignIn = async (): Promise<GoogleSignupProfile | null> => {
      if (oauthError) throw new Error(oauthError.replace(/\+/g, ' '));

      const { data, error: sessionError } = await supabaseBrowser().auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session?.access_token) throw new Error('Google sign-in did not return a session. Please try again.');

      const result = await api<GoogleProfile | { needs_profile: true; email: string; full_name: string; avatar_url: string | null }>(
        '/auth/google',
        { body: { access_token: data.session.access_token, referrer_id: nextReferrer || undefined } }
      );
      if ('needs_profile' in result) {
        return {
          profile: { email: result.email, full_name: result.full_name, avatar_url: result.avatar_url },
          accessToken: data.session.access_token,
          referrerId: nextReferrer,
        };
      }
      return null;
    };

    const attempt = signInAttempt.current ?? finishSignIn();
    signInAttempt.current = attempt;
    attempt.then(async result => {
      if (!active) return;
      if (result) {
        setProfile(result.profile);
        setFullName(result.profile.full_name);
        setAccessToken(result.accessToken);
        setReferrerId(result.referrerId);
        return;
      }
      if (!await refresh()) throw new Error('Google sign-in succeeded, but S Learning could not start your session. Please try again.');
      router.replace(safeNext(nextPath));
    }).catch(e => { if (active) setError(errMsg(e)); });
    return () => { active = false; };
  }, [nextPath, nextReferrer, oauthError, refresh, router]);

  const completeProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      let normalizedPhone = phone.replace(/[\s-]/g, '');
      if (!normalizedPhone.startsWith('+')) normalizedPhone = DIAL[country] + normalizedPhone.replace(/^0/, '');
      await api('/auth/google', {
        body: { access_token: accessToken, country, phone: normalizedPhone, full_name: fullName, referrer_id: referrerId || undefined },
      });
      if (!await refresh()) throw new Error('Your account was created, but S Learning could not start your session. Please try again.');
      router.replace(safeNext(nextPath));
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  };

  if (profile) return (
    <div className="wrap google-callback-wrap">
      <form className="card formcard" onSubmit={completeProfile}>
        <h2>Finish your student account</h2>
        <p className="muted">Signed in with Google as {profile.email}. Add these details to create your S Learning account.</p>
        <label>Full name<input value={fullName} onChange={event => setFullName(event.target.value)} required minLength={3} maxLength={100} autoComplete="name" /></label>
        <label>Country<select value={country} onChange={event => setCountry(event.target.value)}><option value="GH">Ghana</option><option value="NG">Nigeria</option></select></label>
        <label>WhatsApp number<span className="phone-field"><span className="phone-dial" aria-label="Country calling code">{DIAL[country]}</span><input value={phone} onChange={event => setPhone(event.target.value)} type="tel" required placeholder="Phone number" autoComplete="tel-national" /></span></label>
        {referrerId && <p className="muted">Referral ID: {referrerId}</p>}
        <p className="err" role="alert">{error}</p>
        <button className="btn primary block" type="submit" disabled={busy} aria-busy={busy}>{busy ? 'Creating student account…' : 'Create student account'}</button>
      </form>
    </div>
  );

  return (
    <div className="wrap google-callback-wrap">
      <div className="card formcard">
        {error ? <><h2>Google sign-in couldn’t finish</h2><p className="err" role="alert">{error}</p><p><Link href="/signup">Try signing up again</Link> · <Link href="/login">Log in</Link></p></> : <p role="status">Completing Google sign-in…</p>}
      </div>
    </div>
  );
}
