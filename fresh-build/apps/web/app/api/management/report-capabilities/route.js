export const runtime = 'nodejs';

export function GET() {
  return Response.json(
    {
      exportsApproved: process.env.REPORT_EXPORTS_APPROVED === 'true',
      artifactMode: process.env.REPORT_ARTIFACT_WORKER_ENABLED === 'true',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
