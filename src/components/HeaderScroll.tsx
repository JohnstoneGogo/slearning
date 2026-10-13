'use client';
import { useEffect } from 'react';

export default function HeaderScroll() {
  useEffect(() => {
    const header = document.querySelector('.top');
    if (!header) return;
    const handler = () => header.classList.toggle('scrolled', window.scrollY > 10);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);
  return null;
}
