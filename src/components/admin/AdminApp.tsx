'use client';
import { useEffect } from 'react';
import './admin.css';
import { mountAdmin } from './cms';

export default function AdminApp() {
  useEffect(() => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    void mountAdmin(el);
    return () => { document.body.removeChild(el); };
  }, []);
  return null;
}
