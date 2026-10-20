export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
/** Responsive image source: uploaded WebP files have a 480px twin, so listing pages download small files. */
export function imgSrc(u: string | null | undefined, full = false) {
  if (!u) return null;
  const up = /^\/uploads\/.+\.webp$/.test(u)
    || /^https?:\/\/[^/]+\/storage\/v1\/object\/public\/public-media\/.+\.webp(?:\?.*)?$/.test(u);
  const thumb = up ? u.replace(/\.webp(?=\?|$)/, '-480.webp') : u;
  const large = u;
  return { src: full ? large : thumb, srcSet: up ? `${thumb} 480w, ${large} 1200w` : undefined };
}
