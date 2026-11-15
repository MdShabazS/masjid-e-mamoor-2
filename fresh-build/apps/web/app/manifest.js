/** Lets Android (Chrome) and iPhone (Safari or Chrome) add the site to the home screen as an app. */
export default function manifest() {
  return {
    id: '/',
    name: 'Masjid E Mamoor 2',
    short_name: 'Mamoor 2',
    description: 'Masjid information and management',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f7f6f0',
    theme_color: '#145b49',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
