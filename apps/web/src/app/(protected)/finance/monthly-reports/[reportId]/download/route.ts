import { NextResponse } from "next/server";

import { createFinanceMonthlyReportSignedUrl } from "@/lib/finance/server";

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ reportId: string }>;
  },
) {
  const { reportId } = await params;

  try {
    const signedUrl =
      await createFinanceMonthlyReportSignedUrl(
        reportId,
      );

    const response = NextResponse.redirect(
      signedUrl,
      302,
    );

    response.headers.set(
      "Cache-Control",
      "no-store",
    );

    return response;
  } catch {
    return new NextResponse(null, {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }
}
