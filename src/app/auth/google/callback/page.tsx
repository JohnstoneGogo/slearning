import { Suspense } from 'react';
import GoogleSignupCallback from '@/components/GoogleSignupCallback';

export const metadata = { title: 'Finish Google sign-in' };

export default function Page() {
  return <Suspense fallback={<div className="wrap google-callback-wrap"><div className="card formcard"><p>Completing Google sign-in…</p></div></div>}>
    <GoogleSignupCallback />
  </Suspense>;
}
