'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, errMsg, money } from '@/lib/api';
import { useRequireAuth } from './Providers';
import { VerifyBanner } from './Money';

interface Pay { reference: string; status: string }
export default function Activate({ devMode, fees }: { devMode: boolean; fees: Record<string, { currency: string; fee: number }> }) {
  const { me, refresh, toast } = useRequireAuth(), router = useRouter(), ref0 = useSearchParams().get('reference');
  const [ref, setRef] = useState<string | null>(ref0), [status, setStatus] = useState('pending'), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!ref) return; let stop = false;
    const poll = async () => { const p = await api<Pay>('/payments/' + ref).catch(() => null); if (p && !stop) { setStatus(p.status); if (p.status !== 'pending') clearInterval(t); } };
    const t = setInterval(poll, 3000); void poll(); return () => { stop = true; clearInterval(t); };
  }, [ref]);
  if (!me) return null;
  const Box = ({ children }: { children: React.ReactNode }) => <div className="wrap"><section><div className="card formcard"><h2>Account activation</h2>{children}</div></section></div>;
  if (me.status === 'activated') return <Box><p>Your account is active. All member features are unlocked.</p><Link className="btn primary" href="/dashboard">Go to dashboard</Link></Box>;
  const fee = fees[me.country];
  const pay = async () => { setBusy(true); setErr(''); try { const r = await api<{ payment: Pay; checkout_url?: string; message?: string }>('/payments/activation', { method: 'POST', body: {} }); if (r.message) toast(r.message); if (r.checkout_url) location.href = r.checkout_url; else setRef(r.payment.reference); } catch (e) { setErr(errMsg(e)); setBusy(false); } };
  const activate = async () => { setBusy(true); try { await api('/me/activate', { method: 'POST', body: {} }); await refresh(); toast('Account activated.'); router.push('/dashboard'); } catch (e) { setErr(errMsg(e)); setBusy(false); } };
  if (ref && status === 'success') return <Box><p><b>Payment received successfully.</b> Your account is ready for activation.</p><button className="btn primary block" onClick={activate} disabled={busy}>Activate account</button><p className="err">{err}</p></Box>;
  if (ref && status !== 'pending') return <Box><p className="err">We could not confirm your payment. Please check your payment service or try again.</p><Link className="btn primary" href="/activate" onClick={() => { setRef(null); setStatus('pending'); }}>Try again</Link></Box>;
  if (ref) return <Box><p><b>Waiting for payment confirmation.</b> If you were asked to approve a prompt on your phone, please complete it.</p><p className="muted">Please do not pay again while this transaction is pending.</p>
    {devMode && <button className="btn" onClick={() => api(`/dev/payments/${ref}/succeed`, { body: {} })}>Simulate successful payment (dev only)</button>}</Box>;
  return <Box><VerifyBanner me={me} /><p>Review the activation fee and confirm your payment method.</p>
    <div className="card stat"><span>Activation fee</span><b>{money(fee.fee, fee.currency)}</b></div>
    <p className="muted">Activation unlocks all lessons and member features. Paying does not by itself guarantee any reward; eligibility rules apply.</p>
    <button className="btn primary block" onClick={pay} disabled={busy || !me.email_verified}>Pay with {me.country === 'GH' ? 'mobile money or card' : 'card or bank'}</button><p className="err">{err}</p></Box>;
}
