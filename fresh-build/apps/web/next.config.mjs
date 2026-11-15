/** @type {import('next').NextConfig} */
const config = {
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
  outputFileTracingIncludes: {
    '/api/management/report-pdf': ['../../backend/reports/fonts/*.ttf'],
  },
};
export default config;
