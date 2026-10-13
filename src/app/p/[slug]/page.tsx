import { notFound } from 'next/navigation';
import { getPage } from '@/server/data';
import { Prose } from '@/components/bits';

export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const p = await getPage((await params).slug).catch(() => null); return { title: p?.title ?? 'Page' }; }
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const p = await getPage((await params).slug).catch(() => null); if (!p) notFound();
  return <div className="wrap"><section><article className="prose"><h1 style={{ fontSize: '2rem' }}>{p!.title}</h1><Prose text={p!.body} /></article></section></div>;
}
