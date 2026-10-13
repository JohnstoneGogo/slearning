import type { Metadata, Viewport } from 'next';
import Providers from '@/components/Providers';
import Header from '@/components/Header';
import HeaderScroll from '@/components/HeaderScroll';
import Footer from '@/components/Footer';
import PageLoader from '@/components/PageLoader';
import { getCategories, getConfig } from '@/server/data';
import './globals.css';

export const dynamic = 'force-dynamic'; // data is cached in memory for 60s and cleared on every CMS edit

export async function generateMetadata(): Promise<Metadata> {
  const s = (await getConfig()).site;
  return { title: { default: `${s.name} | ${s.tagline}`, template: `%s | ${s.name}` }, description: 'Practical eBooks and courses, certificates, and a reward programme for learners in Ghana and Nigeria.',
    manifest: '/manifest.webmanifest', icons: { icon: '/icon.svg' }, metadataBase: new URL(process.env.APP_URL || 'http://localhost:3000') };
}
export const viewport: Viewport = { themeColor: '#10233f', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [config, categories] = await Promise.all([getConfig(), getCategories()]);
  const s = config.site;
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <Providers>
          <Header name={s.name} categories={categories.map(({ id, name }) => ({ id, name }))} /><HeaderScroll /><PageLoader />
          <main id="main" tabIndex={-1}>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
