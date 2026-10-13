import { Suspense } from 'react';
import { ForgotForm } from '@/components/AuthForms';

export const metadata = { title: 'Forgot password' };
export default function Page() { return <Suspense><ForgotForm /></Suspense>; }
