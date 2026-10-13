import { validateEnv } from './server/core';
import { reconcile } from './server/payments';

// H-01: validate critical env vars at startup — fail fast rather than silently using defaults
validateEnv();

const g = globalThis as { __slWorker?: boolean };
if (!g.__slWorker) {
  g.__slWorker = true;
  setInterval(() => { reconcile().catch(e => console.error('reconcile', e)); }, 20000).unref();
}
