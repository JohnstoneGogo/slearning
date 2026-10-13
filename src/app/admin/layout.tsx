import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { userFrom } from '@/server/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'CMS', robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const u = await userFrom(new Request('http://internal', { headers: await headers() })).catch(() => null);
  if (!u || u.role !== 'admin') redirect('/admin-login');
  return <>{children}</>;
}
