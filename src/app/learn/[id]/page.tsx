import { Suspense } from 'react';
import Learn from '@/components/Learn';
export const metadata = { title: 'Learn' };
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <Suspense><Learn id={(await params).id} /></Suspense>; }
