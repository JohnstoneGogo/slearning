'use client';
import { useEffect, useRef } from 'react';
import './admin.css';
import './admin-upgrade.css';
import { mountAdmin } from './cms';

export default function AdminApp() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    void mountAdmin(host.current);
    return () => { host.current?.replaceChildren(); };
  }, []);

  return <div id="admin-app-root" ref={host} />;
}
