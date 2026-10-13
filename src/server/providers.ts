// Payment provider adapters. Paystack covers cards, mobile money and bank in Ghana (GHS) and Nigeria (NGN).
// To add Flutterwave later, write another object with the same shape and return it from provider().
import crypto from 'node:crypto';

const SK = process.env.PAYSTACK_SECRET_KEY;
export const LIVE = !!SK && process.env.PAYMENT_PROVIDER !== 'mock';

export class ProviderError extends Error { constructor(m: string, public http: number) { super(m); } }
export type PayStatus = 'success' | 'failed' | 'pending';
export interface Provider {
  name: string; live: boolean;
  initialize(a: { reference: string; amount: number; currency: string; email: string; callbackUrl: string; metadata: object }): Promise<{ url: string | null }>;
  verify(reference: string): Promise<{ status: PayStatus; amount: number; currency: string }>;
  banks(country: string): Promise<{ name: string; code: string }[]>;
  resolve(a: { account_number: string; bank_code: string }): Promise<{ account_name: string | null }>;
  createRecipient(a: { type: string; name: string; account_number: string; bank_code: string; currency: string }): Promise<string>;
  transfer(a: { reference: string; amount: number; recipient: string; reason: string }): Promise<{ status: string }>;
  verifyTransfer(reference: string): Promise<{ status: PayStatus }>;
  verifyWebhook(raw: string, sig: string | null): boolean;
  parseWebhook(b: any): { kind: 'payment' | 'transfer'; reference: string; status: PayStatus; amount?: number; currency?: string } | null;
}

async function ps(path: string, method = 'GET', body?: object): Promise<any> {
  const r = await fetch('https://api.paystack.co' + path, { method, headers: { Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.status === false) throw new ProviderError(d.message || 'Payment provider error', r.status);
  return d.data;
}
const CHANNELS: Record<string, string[]> = { GHS: ['mobile_money', 'card'], NGN: ['card', 'bank', 'bank_transfer', 'ussd'] };
const COUNTRY: Record<string, string> = { GH: 'ghana', NG: 'nigeria' };

const paystack: Provider = {
  name: 'paystack', live: true,
  async initialize({ reference, amount, currency, email, callbackUrl, metadata }) {
    const d = await ps('/transaction/initialize', 'POST', { reference, amount, currency, email, callback_url: callbackUrl, channels: CHANNELS[currency], metadata });
    return { url: d.authorization_url };
  },
  async verify(reference) {
    const d = await ps('/transaction/verify/' + encodeURIComponent(reference));
    return { status: d.status === 'success' ? 'success' : ['failed', 'abandoned', 'reversed'].includes(d.status) ? 'failed' : 'pending', amount: d.amount, currency: d.currency };
  },
  async banks(country) { const d = await ps(`/bank?country=${COUNTRY[country]}&perPage=200`); return d.filter((b: any) => b.type !== 'mobile_money' && !b.is_deleted).map((b: any) => ({ name: b.name, code: b.code })); },
  async resolve({ account_number, bank_code }) { const d = await ps(`/bank/resolve?account_number=${encodeURIComponent(account_number)}&bank_code=${encodeURIComponent(bank_code)}`); return { account_name: d.account_name }; },
  async createRecipient(a) { return (await ps('/transferrecipient', 'POST', a)).recipient_code; },
  async transfer({ reference, amount, recipient, reason }) { const d = await ps('/transfer', 'POST', { source: 'balance', amount, recipient, reason, reference }); return { status: d.status }; },
  async verifyTransfer(reference) { const d = await ps('/transfer/verify/' + encodeURIComponent(reference)); return { status: d.status === 'success' ? 'success' : ['failed', 'reversed'].includes(d.status) ? 'failed' : 'pending' }; },
  verifyWebhook(raw, sig) { const x = crypto.createHmac('sha512', SK!).update(raw).digest('hex'), g = sig || ''; return g.length === x.length && crypto.timingSafeEqual(Buffer.from(g), Buffer.from(x)); },
  parseWebhook(b) {
    const d = b?.data || {};
    if (b?.event === 'charge.success') return { kind: 'payment', reference: d.reference, status: 'success', amount: d.amount, currency: d.currency };
    if (b?.event === 'transfer.success') return { kind: 'transfer', reference: d.reference, status: 'success' };
    if (b?.event === 'transfer.failed' || b?.event === 'transfer.reversed') return { kind: 'transfer', reference: d.reference, status: 'failed' };
    return null;
  }
};
// Local development stand-in: no money moves. A dev-only button and a delayed fake payout complete the flow.
const mock: Provider = {
  name: 'mock', live: false,
  async initialize() { return { url: null }; }, async verify() { return { status: 'pending', amount: 0, currency: '' }; },
  async banks() { return [{ name: 'Sample Bank', code: '000' }]; }, async resolve() { return { account_name: null }; },
  async createRecipient() { return 'MOCK_RCP'; }, async transfer() { return { status: 'pending' }; }, async verifyTransfer() { return { status: 'pending' }; },
  verifyWebhook() { return false; }, parseWebhook() { return null; }
};
export const provider = (): Provider => (LIVE ? paystack : mock);
