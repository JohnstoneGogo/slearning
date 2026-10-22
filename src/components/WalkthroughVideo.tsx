'use client';

export default function WalkthroughVideo({ url, poster }: { url?: string; poster?: string }) {
  if (!url) {
    return (
      <div className="vframe" role="img" aria-label="Slearning walkthrough video coming soon">
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: '1.5rem', textAlign: 'center', color: '#fff' }}>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem' }}>Walkthrough video coming soon</p>
            <p style={{ margin: '.5rem 0 0', opacity: .85, fontSize: '.95rem' }}>A short tour of the Slearning experience will be added here.</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="vframe">
      <video controls playsInline preload="metadata" poster={poster || undefined} aria-label="See how Slearning works">
        <source src={url} />
        <track kind="captions" srcLang="en" label="English" default />
        Your browser does not support the video tag.
      </video>
    </div>
  );
}
