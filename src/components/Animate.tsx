'use client';
import { useEffect, useRef } from 'react';

export default function Animate({ children, className = '', delay = 0, style = {} }: {
  children: React.ReactNode; className?: string; delay?: number; style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    // If already in view on mount (e.g. above the fold), animate immediately
    const ob = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add('in'); ob.disconnect(); } },
      { threshold: 0.05, rootMargin: '0px 0px -20px 0px' }
    );
    ob.observe(el);
    // Fallback: if still not visible after 800ms, show anyway
    const t = setTimeout(() => { el.classList.add('in'); ob.disconnect(); }, 800);
    return () => { ob.disconnect(); clearTimeout(t); };
  }, []);
  return (
    <div ref={ref} className={`fade-up ${className}`} style={{ transitionDelay: `${delay}ms`, ...style }}>
      {children}
    </div>
  );
}
