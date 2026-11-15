/** @type {import('next').NextConfig} */
const config = {
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
  outputFileTracingIncludes: {
    '/api/management/report-pdf': ['../../backend/reports/fonts/*.ttf'],
  },
  async headers() {
    return [
      {
        // The service worker must always be fetched fresh so fixes reach phones at once.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};
export default config;
