'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from './Providers';
import { LogoMark } from './Logo';

interface Note { id: number; title: string; body: string; link: string | null; read: boolean }
interface NavCategory { id: number; name: string }

function CoursesDropdown({ categories, path, desktop = false }: { categories: NavCategory[]; path: string; desktop?: boolean }) {
  const setOpenOnInteraction = (isOpen: boolean) => (
    event: React.MouseEvent<HTMLDetailsElement> | React.FocusEvent<HTMLDetailsElement>
  ) => {
    if (desktop && window.matchMedia('(min-width: 821px)').matches) {
      event.currentTarget.open = isOpen;
    }
  };
  const active = path.startsWith('/courses');

  return (
    <details
      onMouseEnter={desktop ? setOpenOnInteraction(true) : undefined}
      onMouseLeave={desktop ? setOpenOnInteraction(false) : undefined}
      onFocus={desktop ? setOpenOnInteraction(true) : undefined}
      onBlur={desktop ? setOpenOnInteraction(false) : undefined}
      className={`nav-help nav-courses${active ? ' on' : ''}`}
    >
      <summary aria-haspopup="true">Courses</summary>
      <div className="nav-dropdown-menu" aria-label="Course categories">
        <Link href="/courses">All courses</Link>
        {categories.map(category => (
          <Link key={category.id} href={`/courses?cat=${category.id}`}>{category.name}</Link>
        ))}
      </div>
    </details>
  );
}

export default function Header({ name, categories }: { name: string; categories: NavCategory[] }) {
  const { me, logout, mounted } = useAuth();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [panel, setPanel] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
    setPanel(false);
    document.querySelectorAll<HTMLDetailsElement>('.nav-help').forEach(item => { item.open = false; });
  }, [path]);
  useEffect(() => {
    if (me) api<Note[]>('/me/notifications').then(setNotes).catch(() => {});
    else setNotes(null);
  }, [me, path]);

  // lock body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // close panel on outside click
  useEffect(() => {
    if (!panel) return;
    const handler = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node) && !bellRef.current?.contains(e.target as Node)) setPanel(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [panel]);

  // close drawer + panel on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setPanel(false);
        document.querySelectorAll<HTMLDetailsElement>('.nav-help').forEach(item => { item.open = false; });
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // trap focus in notification panel
  useEffect(() => {
    if (!panel || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>('a,button,[tabindex]:not([tabindex="-1"])');
    focusable[0]?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
        e.preventDefault(); (e.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [panel]);

  const unread = notes?.filter(n => !n.read).length ?? 0;
  const on = (p: string) => path.startsWith(p) ? 'on' : '';

  const toggle = async () => {
    setPanel(p => !p);
    if (!panel && unread) {
      await api('/me/notifications/read', { body: {} }).catch(() => {});
      setNotes(n => n && n.map(x => ({ ...x, read: true })));
    }
  };
  const setHelpOnHover = (isOpen: boolean) => (
    event: React.MouseEvent<HTMLDetailsElement> | React.FocusEvent<HTMLDetailsElement>
  ) => {
    if (window.matchMedia('(min-width: 821px)').matches) {
      event.currentTarget.open = isOpen;
    }
  };

  return (
    <>
      <header className="top" role="banner">
        <div className="wrap bar">
          <Link className="brand" href={me ? '/dashboard' : '/'} aria-label={`${name} — home`}>
            <LogoMark /><span>{name}</span>
          </Link>

          {/* Desktop nav */}
          <nav className="desk-nav" aria-label="Main navigation">
            {!mounted ? null : me ? (
              <>
                <Link className={on('/dashboard')} href="/dashboard">Dashboard</Link>
                <CoursesDropdown categories={categories} path={path} desktop />
                <Link className={on('/earnings')} href="/earnings">Earnings</Link>
                <Link className={on('/withdraw')} href="/withdraw">Withdraw</Link>
                <Link className={on('/profile')} href="/profile">Profile</Link>
                {me.role === 'admin' && <Link href="/admin" className={on('/admin')}>Admin</Link>}
                <details
                  onMouseEnter={setHelpOnHover(true)}
                  onMouseLeave={setHelpOnHover(false)}
                  onFocus={setHelpOnHover(true)}
                  onBlur={setHelpOnHover(false)}
                  className={`nav-help${path === '/faq' || path === '/contact' || path.startsWith('/p/help') ? ' on' : ''}`}
                >
                  <summary aria-haspopup="true">Help</summary>
                  <div className="nav-dropdown-menu">
                    <Link href="/faq">Frequently asked questions</Link>
                    <Link href="/p/help">Help centre</Link>
                    <Link href="/contact">Contact us</Link>
                  </div>
                </details>
                <button ref={bellRef} className="btn sm bell" onClick={toggle}
                  aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
                  aria-expanded={panel} aria-haspopup="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                  {unread > 0 && <span className="dot" aria-hidden="true">{unread}</span>}
                </button>
                <button className="btn sm" onClick={logout}>Log out</button>
              </>
            ) : (
              <>
                <Link href="/">Home</Link>
                <CoursesDropdown categories={categories} path={path} desktop />
                <Link className={on('/about')} href="/about">About</Link>
                <a href="/#how">How it works</a>
                <a href="/#why">Why us</a>
                <details
                  onMouseEnter={setHelpOnHover(true)}
                  onMouseLeave={setHelpOnHover(false)}
                  onFocus={setHelpOnHover(true)}
                  onBlur={setHelpOnHover(false)}
                  className={`nav-help${path === '/faq' || path === '/contact' || path.startsWith('/p/help') ? ' on' : ''}`}
                >
                  <summary aria-haspopup="true">Help</summary>
                  <div className="nav-dropdown-menu">
                    <Link href="/faq">Frequently asked questions</Link>
                    <Link href="/p/help">Help centre</Link>
                    <Link href="/contact">Contact us</Link>
                  </div>
                </details>
                <Link className="btn sm nav-login" href="/login">Log in</Link>
                <Link className="btn sm primary nav-signup" href="/signup">Sign up free</Link>
              </>
            )}
          </nav>

          {/* Burger */}
          <button
            className={`burger${open ? ' active' : ''}`}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-drawer"
            onClick={() => setOpen(o => !o)}
          >
            <span className="burger-box" aria-hidden="true">
              <span /><span /><span />
            </span>
          </button>

          {/* Notification panel */}
          {panel && (
            <div ref={panelRef} className="panel" role="dialog" aria-label="Notifications" aria-modal="true">
              <div className="panel-head">
                <span className="panel-title">Notifications</span>
                <button className="btn sm" onClick={() => setPanel(false)} aria-label="Close notifications">✕</button>
              </div>
              {notes?.length
                ? notes.map(n => (
                  <Link key={n.id} href={n.link || '/dashboard'} className={n.read ? '' : 'unread'}>
                    <b>{n.title}</b><br /><small>{n.body}</small>
                  </Link>
                ))
                : <p className="muted" style={{ padding: '12px 16px', margin: 0 }}>No notifications yet.</p>
              }
            </div>
          )}
        </div>
      </header>

      {/* Overlay */}
      {open && <div className="drawer-overlay" aria-hidden="true" onClick={() => setOpen(false)} />}

      {/* Slide-in drawer */}
      <div
        id="mobile-drawer"
        ref={drawerRef}
        className={`drawer${open ? ' drawer-open' : ''}`}
        aria-label="Mobile navigation"
        role="dialog"
        aria-modal="true"
      >
        <div className="drawer-head">
          <Link className="brand" href={me ? '/dashboard' : '/'} onClick={() => setOpen(false)}>
            <LogoMark /><span>{name}</span>
          </Link>
          <button className="drawer-close" aria-label="Close menu" onClick={() => setOpen(false)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <nav className="drawer-nav" aria-label="Mobile navigation">
          {!mounted ? null : me ? (
            <>
              <Link className={on('/dashboard')} href="/dashboard">Dashboard</Link>
              <CoursesDropdown categories={categories} path={path} />
              <Link className={on('/earnings')} href="/earnings">Earnings</Link>
              <Link className={on('/withdraw')} href="/withdraw">Withdraw</Link>
              <Link className={on('/profile')} href="/profile">Profile</Link>
              {me.role === 'admin' && <Link href="/admin" className={on('/admin')}>Admin</Link>}
              <details className={`nav-help${path === '/faq' || path === '/contact' || path.startsWith('/p/help') ? ' on' : ''}`}>
                <summary aria-haspopup="true">Help</summary>
                <div className="nav-dropdown-menu">
                  <Link href="/faq">Frequently asked questions</Link>
                  <Link href="/p/help">Help centre</Link>
                  <Link href="/contact">Contact us</Link>
                </div>
              </details>
              <div className="drawer-divider" />
              <button className="btn block" onClick={logout}>Log out</button>
            </>
          ) : (
            <>
              <Link href="/">Home</Link>
              <CoursesDropdown categories={categories} path={path} />
              <Link className={on('/about')} href="/about" onClick={() => setOpen(false)}>About</Link>
              <a href="/#how" onClick={() => setOpen(false)}>How it works</a>
              <a href="/#why" onClick={() => setOpen(false)}>Why us</a>
              <details className={`nav-help${path === '/faq' || path === '/contact' || path.startsWith('/p/help') ? ' on' : ''}`}>
                <summary aria-haspopup="true">Help</summary>
                <div className="nav-dropdown-menu">
                  <Link href="/faq">Frequently asked questions</Link>
                  <Link href="/p/help">Help centre</Link>
                  <Link href="/contact">Contact us</Link>
                </div>
              </details>
              <div className="drawer-divider" />
              <Link className="btn block nav-login" href="/login">Log in</Link>
              <Link className="btn block primary nav-signup" href="/signup">Sign up free</Link>
            </>
          )}
        </nav>
      </div>
    </>
  );
}
