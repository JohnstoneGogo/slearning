'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { errMsg } from '@/lib/api';
import { supabaseBrowser } from '@/lib/supabase-browser';

export default function GoogleSignInButton({ label = 'Continue with Google' }: { label?: string }) {
  const search = useSearchParams();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setError('');
    setBusy(true);
    try {
      const callback = new URL('/auth/google/callback', window.location.origin);
      const next = search.get('next');
      const referrer = search.get('ref');
      if (next) callback.searchParams.set('next', next);
      if (referrer) callback.searchParams.set('ref', referrer);
      const { error: oauthError } = await supabaseBrowser().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callback.toString() },
      });
      if (oauthError) throw oauthError;
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  };

  return (
    <div className="google-signin">
      <button className="btn google-signin-button" type="button" onClick={signIn} disabled={busy} aria-busy={busy}>
        <svg viewBox="0 0 48 48" width="19" height="19" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 5)" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.4-4.55H24v9.02h12.94a11.05 11.05 0 0 1-4.8 7.25l7.74 6C44.4 38.05 46.98 31.9 46.98 24.55Z" />
          <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.2a23.9 23.9 0 0 0 0 21.58l7.98-6.2Z" transform="translate(0 5)" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.78l-7.74-6c-2.15 1.45-4.9 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.2C6.51 42.62 14.62 48 24 48Z" transform="translate(0 -5)" />
        </svg>
        {busy ? 'Connecting to Google…' : label}
      </button>
      {error && <p className="err" role="alert">{error}</p>}
    </div>
  );
}
