'use client';
import { useEffect } from 'react';

/** Registers the offline-page service worker. It only answers when the network fails, so it is safe in development too. */
export default function RegisterServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch(() => {});
  }, []);
  return null;
}
