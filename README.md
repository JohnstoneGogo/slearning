# S Learning

Learning + earnings platform for Ghana and Nigeria. **Next.js 15 (App Router) · TypeScript · Prisma · PostgreSQL.**
One REST API (`/api/v1`) powers the website, the CMS (`/admin`) and your future **mobile app**.

## Quick start
```bash
cp .env.example .env            # then edit secrets
docker compose up -d            # PostgreSQL on :5432 (or point DATABASE_URL at your own)
npm install
npx prisma migrate dev --name init   # creates the tables and the first migration (commit prisma/migrations)
npm run db:seed                 # placeholder content + admin user
npm run dev                     # http://localhost:3000   CMS: /admin
```
Before running `npm run db:seed`, set `ADMIN_USERNAME`, `ADMIN_EMAIL`, and a unique `ADMIN_PASSWORD` of at least 16 characters in `.env`. The seed refuses missing or weak admin credentials; there are no default administrator credentials.
Production: `npm run build && npm run db:deploy && npm start` (or `docker build -t s-learning .`).

## Structure
```
prisma/schema.prisma        data model (money = integer minor units)   prisma/seed.ts   placeholder content
src/app/                    pages (server components for public pages, client components for member screens)
src/app/api/v1/[[...path]]  one catch-all route handler -> src/server/routes/*  (public, auth, member, learning, admin)
src/server/                 db, auth (JWT cookie + Bearer), payments (Paystack), providers, ledger helpers, mail
src/components/             UI (Header, Learn player, Withdraw, CMS in components/admin/*)
```
## Where to change placeholders
Prices, rewards, limits, business details, video URL, homepage reviews: **CMS > Settings** (or `prisma/seed.ts` before seeding). Amounts are in minor units in the DB; the CMS shows normal amounts.
Images: CMS upload (auto-optimised WebP + thumbnail) or paste a URL; empty images show labelled placeholders.
Logo: temporary mark in `src/components/Logo.tsx` and `public/icon.svg`. Brand name comes from the `site` setting.
Course catalogue: search by keyword, topic, skill level, access, duration, and language. Duration filters use each course's total minutes; language choices come from published courses.

## Payments (Paystack, GHS + NGN)
1. Put your secret key in `PAYSTACK_SECRET_KEY`. Webhook URL in Paystack: `https://YOUR_DOMAIN/api/v1/webhooks/paystack`.
2. For payouts: fund your Paystack balance and turn **off** "Confirm transfers before sending" in Paystack settings (otherwise transfers wait for an OTP).
3. Set `APP_URL` to your public https address.
Activation: checkout (mobile money/card/bank) -> webhook **and** server-side verify -> amount and currency must match -> account can be activated. Payouts use stable references (no double pay), webhooks + a reconciliation worker finalise them, and withdrawals above the review threshold wait for CMS approval. With no key the app runs in **mock mode** (no money moves).
Course access: set each course's Ghana (GHS) and Nigeria (NGN) price in **CMS > Courses**. Leave a price blank until configured; enter `0` for a free course. Prices are stored in minor units. A successful, server-verified purchase unlocks only that course, including for an unactivated learner; activated accounts retain platform-wide course access. The course page and catalogue show both configured prices.
Not testable from my environment: live Paystack calls. Test in Paystack test mode first and check the current API docs.
**Worker:** a long-running server (`next start`/Docker) reconciles payouts automatically. On serverless hosts call `GET /api/v1/cron/reconcile` every minute with `Authorization: Bearer $CRON_SECRET`.

## Speed
Server-rendered public pages with small client bundles (~108 kB shared JS), gzip, API responses with `Cache-Control` + 60s server cache cleared on CMS edits, immutable long-cache uploads, responsive lazy images, skeleton loaders, DB indexes, service worker for repeat visits. Put a CDN (Cloudflare) in front for best results.

## Money safety
Immutable ledger (`pending/available/held/withdrawn`), balances derived from it, a PostgreSQL row lock + transaction around withdrawals and activation, idempotency keys, atomic one-time token use, HMAC-SHA512 webhook verification, rate limits, audit log, suspended accounts blocked.

## Mobile app
Same endpoints; send `Authorization: Bearer <token>` (returned by `/auth/login`). Admin endpoints: `/api/v1/admin/*`.

## Before launch
Legal pages and the referral/reward model need professional review (Ghana + Nigeria). Add 2FA/KYC for withdrawals, backups, monitoring, move rate limits/cache to Redis if you run several servers, and add real content in the CMS.
