'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api, errMsg, money, when } from '@/lib/api';
import { Summary, VerifyBanner, useFreshMe } from './Money';

interface Opts { currency: string; methods: string[]; min: number; fee_percent: number; banks: { name: string; code: string }[]; verify_account: boolean }
interface Row { id: number; amount: number; currency: string; method: string; status: string; note: string | null; created_at: string }
const MOMO = ['MTN Mobile Money', 'Telecel Cash', 'AirtelTigo Money'];

export default function Withdraw() {
  const { me, ready, toast, refresh } = useFreshMe(), [o, setO] = useState<Opts | null>(null), [hist, setHist] = useState<Row[]>([]);
  const [f, setF] = useState({ amount: '', method: '', bank_code: '', account_number: '', account_name: '' }), [review, setReview] = useState(false), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const key = useMemo(() => crypto.randomUUID(), [hist.length]); // new key per fresh form, same key on retries of the same request
  const load = () => { api<Opts>('/withdrawals/options').then(x => { setO(x); setF(p => ({ ...p, method: p.method || x.methods[0], bank_code: p.bank_code || x.banks[0]?.code || '' })); }).catch(() => {}); api<Row[]>('/withdrawals').then(setHist).catch(() => {}); };
  useEffect(() => { if (me) load(); }, [me?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!me || !ready || !o) return <div className="wrap"><div className="skel" style={{ height: 300, marginTop: 24 }} /></div>;
  const bank = !MOMO.includes(f.method), set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setF({ ...f, [k]: e.target.value }); setReview(false); };
  const a = Math.round(+f.amount * 100), fee = Math.round(a * o.fee_percent / 100);
  const verify = async () => { try { const r = await api<{ account_name: string | null }>('/withdrawals/verify-account', { body: { account_number: f.account_number, bank_code: f.bank_code } }); setF(p => ({ ...p, account_name: r.account_name || '' })); toast('Account name found.'); } catch (e) { toast(errMsg(e)); } };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    if (!review) { if (a < o.min) return setErr('The amount is below the minimum withdrawal.'); return setReview(true); }
    setBusy(true); try { await api('/withdrawals', { body: { ...f, idempotency_key: key } }); toast('Withdrawal submitted.'); setReview(false); setF(p => ({ ...p, amount: '' })); await refresh(); load(); } catch (x) { setErr(errMsg(x)); } setBusy(false);
  };
  return <div className="wrap"><section>
    <h1 style={{ fontSize: '2rem' }}>Withdraw</h1><Summary me={me} /><br /><VerifyBanner me={me} />
    {me.status !== 'activated' && <div className="notice"><span>Activate your account to withdraw.</span><Link className="btn primary" href="/activate">Activate account</Link></div>}
    <form className="card formcard" style={{ margin: '0 0 24px' }} onSubmit={submit}>
      <label>Amount ({o.currency}), minimum {money(o.min, o.currency)}<input type="number" step="0.01" min="0" required inputMode="decimal" value={f.amount} onChange={set('amount')} /></label>
      <label>Payout method<select value={f.method} onChange={set('method')}>{o.methods.map(m => <option key={m}>{m}</option>)}</select></label>
      {bank && <label>Bank<select value={f.bank_code} onChange={set('bank_code')}>{o.banks.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}</select></label>}
      <label>{bank ? 'Account number' : 'Mobile money number'}<input required inputMode="numeric" value={f.account_number} onChange={set('account_number')} /></label>
      {o.verify_account && bank && <button className="btn" type="button" onClick={verify}>Verify account name</button>}
      <label>Account name<input required value={f.account_name} onChange={set('account_name')} /></label>
      {review && <div className="card"><p>Amount: <b>{money(a, o.currency)}</b><br />Fee ({o.fee_percent}%): <b>{money(fee, o.currency)}</b><br />You receive: <b>{money(a - fee, o.currency)}</b><br />To: <b>{f.account_name}</b> ({f.method})</p></div>}
      <p className="err" role="alert">{err}</p><button className="btn primary block" disabled={busy}>{review ? 'Confirm withdrawal' : 'Review withdrawal'}</button>
    </form>
    <h2>History</h2>
    <div className="tbl card"><table><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Status</th></tr></thead><tbody>
      {hist.map(w => <tr key={w.id}><td>{when(w.created_at)}</td><td>{money(w.amount, w.currency)}</td><td>{w.method}</td><td>{w.status}{w.note && <><br /><small className="muted">{w.note}</small></>}</td></tr>)}
      {!hist.length && <tr><td colSpan={4} className="muted">No withdrawals yet.</td></tr>}</tbody></table></div>
    <p className="muted">Payouts are processed as fast as possible but are not guaranteed to be instant. Large amounts may be reviewed first. Need help? <Link href="/#contact">Contact support</Link>.</p>
  </section></div>;
}
