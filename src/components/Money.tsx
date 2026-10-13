'use client';
import { useEffect, useState } from 'react';
import { api, money, type Me } from '@/lib/api';
import { useAuth } from './Providers';

export const Summary = ({ me }: { me: Me }) => {
  const b = me.balances, c = me.currency;
  return <div className="stats">{([['Total earned', b.total_earned], ['Available balance', b.available], ['Pending rewards', b.pending + b.held], ['Total withdrawn', b.withdrawn]] as const).map(x => <div className="card stat" key={x[0]}><span>{x[0]}</span><b>{money(x[1], c)}</b></div>)}</div>;
};
export function VerifyBanner({ me }: { me: Me }) {
  const { toast } = useAuth(); if (me.email_verified) return null;
  return <div className="notice"><div><h3>Verify your email</h3><span className="muted">We sent a link to {me.email}. You need it before paying or withdrawing.</span></div>
    <button className="btn" onClick={() => api('/auth/resend', { body: {} }).then(() => toast('Verification email sent.')).catch(e => toast(e.message))}>Resend email</button></div>;
}
/** Re-reads the account (balances change on the server) and returns it. */
export function useFreshMe() {
  const a = useAuth(), [ready, setReady] = useState(false);
  useEffect(() => { if (!a.loading && a.me) a.refresh().then(() => setReady(true)); }, [a.loading]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...a, ready };
}
