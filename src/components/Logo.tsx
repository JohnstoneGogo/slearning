export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M4 20 32 7l28 13-28 14L4 20Z" fill="#245a91" />
      <path d="M15 27v13c9 7 25 7 34 0V27L32 37 15 27Z" fill="#17365d" />
      <path d="M55 23v18" stroke="#245a91" strokeWidth="3" strokeLinecap="round" />
      <circle cx="55" cy="44" r="3" fill="#245a91" />
      <path d="M14 44c7-3 13-2 18 2v11c-5-4-11-5-18-2V44Zm36 0c-7-3-13-2-18 2v11c5-4 11-5 18-2V44Z" fill="#e8f0f8" stroke="#17365d" strokeWidth="2" strokeLinejoin="round" />
      <path d="M32 46v11" stroke="#245a91" strokeWidth="2" />
    </svg>
  );
}
