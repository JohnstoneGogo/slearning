'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function PageLoader() {
  const path = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 600);
    return () => clearTimeout(t);
  }, [path]);

  if (!visible) return null;
  return (
    <div className="page-loader" aria-hidden="true">
      <div className="orbit">
        <span /><span /><span />
      </div>
    </div>
  );
}
