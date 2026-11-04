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
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.22 3.31v2.77h3.58c2.1-1.94 3.28-4.8 3.28-8.09Z" />
          <path fill="#34A853" d="M12 23c3.02 0 5.56-1 7.41-2.66l-3.58-2.77c-1 .67-2.27 1.07-3.83 1.07-2.94 0-5.43-1.98-6.32-4.65H1.99v2.84A11 11 0 0 0 12 23Z" />
          <path fill="#FBBC05" d="M5.68 13.99a6.6 6.6 0 0 1 0-3.98V7.17H1.99a11 11 0 0 0 0 9.66l3.69-2.84Z" />
          <path fill="#EA4335" d="M12 5.36c1.64 0 3.11.56 4.27 1.67l3.2-3.2C17.55 1.99 15.02 1 12 1A11 11 0 0 0 1.99 7.17l3.69 2.84C6.57 7.34 9.06 5.36 12 5.36Z" />
        </svg>
        {busy ? 'Connecting to Google…' : label}
      </button>
      {error && <p className="err" role="alert">{error}</p>}
    </div>
  );
}
