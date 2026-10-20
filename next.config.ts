import type { NextConfig } from 'next';

const PROD = process.env.NODE_ENV === 'production';

// C-01: env-driven CORS allowlist — never wildcard in production
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ['sharp', 'bcryptjs', 'pg'],

  async headers() {
    // C-01: CORS — only allow listed origins; fall back to same-origin in production
    const corsHeaders = corsOrigins.length > 0
      ? [
          { key: 'Access-Control-Allow-Origin', value: corsOrigins[0] },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Vary', value: 'Origin' },
        ]
      : PROD
        ? [] // same-origin only in production when no allowlist is set
        : [
            { key: 'Access-Control-Allow-Origin', value: 'http://localhost:3000' },
            { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
            { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' },
          ];

    const security = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      // L-07: extended Permissions-Policy
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
      // C-03: Content-Security-Policy
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          `script-src 'self' 'unsafe-inline'${PROD ? '' : " 'unsafe-eval'"}`, // Next.js dev refresh requires eval; never permit it in production
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "img-src 'self' data: blob: https:",
          "font-src 'self' https://fonts.gstatic.com",
          `connect-src 'self' https://api.paystack.co${PROD ? '' : ' ws://127.0.0.1:* ws://localhost:*'}`,
          "frame-src 'self' https://*.supabase.co",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "upgrade-insecure-requests",
        ].join('; '),
      },
      // H-09: HSTS — only in production
      ...(PROD ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }] : []),
    ];

    return [
      ...(corsHeaders.length > 0 ? [{ source: '/api/:path*', headers: corsHeaders }] : []),
      { source: '/:path*', headers: security },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
      {
        source: '/admin/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default nextConfig;
