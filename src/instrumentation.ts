// Starts the payout reconciliation loop when running as a long-lived Node server (next start / Docker).
// On serverless hosts, call GET /api/v1/cron/reconcile every minute with "Authorization: Bearer $CRON_SECRET" instead.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./instrumentation-node');
}
