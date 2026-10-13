import { Suspense } from 'react';
import Activate from '@/components/Activate';
import { getConfig } from '@/server/data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Activate your account' };
export default async function Page() {
  const c = await getConfig();
  return <Suspense><Activate devMode={c.dev} fees={Object.fromEntries(c.countries.map(x => [x.code, { currency: x.currency, fee: x.activation_fee }]))} /></Suspense>;
}
