import { NextResponse } from "next/server";

import { createDonationPaymentProofSignedUrl } from "@/lib/donations/server";

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ proofId: string }>;
  },
) {
  const { proofId } = await params;

  try {
    const signedUrl =
      await createDonationPaymentProofSignedUrl(proofId);
    const response = NextResponse.redirect(signedUrl, 302);

    response.headers.set("Cache-Control", "no-store");

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
