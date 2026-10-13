/** TEMPORARY logo: swap this file (or public/icon.svg) for your real brand mark later. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#10233f" />
      <path d="M44 21c-2-5-7-8-13-8-7 0-12 4-12 10 0 13 25 7 25 19 0 6-6 10-13 10-7 0-12-3-14-9" fill="none" stroke="#2674e8" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}
