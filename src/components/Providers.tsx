'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type Me } from '@/lib/api';

interface Auth { me: Me | null; loading: boolean; mounted: boolean; refresh: () => Promise<Me | null>; logout: () => Promise<void>; toast: (m: string) => void }
const Ctx = createContext<Auth>({ me: null, loading: true, mounted: false, refresh: async () => null, logout: async () => {}, toast: () => {} });
export const useAuth = () => useContext(Ctx);

/** Redirects to /login when signed out. Returns the user once known. */
export function useRequireAuth() {
  const a = useAuth(), router = useRouter();
  useEffect(() => { if (!a.loading && !a.me) router.replace('/login'); }, [a.loading, a.me, router]);
  return a;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null), [loading, setLoading] = useState(true), [mounted, setMounted] = useState(false), [msg, setMsg] = useState(''), router = useRouter();
  const refresh = useCallback(async () => { try { const u = await api<Me>('/me'); setMe(u); return u; } catch { setMe(null); return null; } finally { setLoading(false); } }, []);
  useEffect(() => { setMounted(true); void refresh(); }, [refresh]);
  useEffect(() => { if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {}); }, []);
  const toast = useCallback((m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3500); }, []);
  const logout = useCallback(async () => { await api('/auth/logout', { method: 'POST', body: {} }).catch(() => {}); setMe(null); window.location.href = '/'; }, []);
  return (
    <Ctx.Provider value={{ me, loading, mounted, refresh, logout, toast }}>
      {children}
      <div id="toast" className={msg ? 'on' : ''} role="status" aria-live="polite">{msg}</div>
    </Ctx.Provider>
  );
}
