import { NextResponse } from "next/server";
import { referralDecisionSchema } from "@masjid-e-mamoor/validation";
import { approveReferral } from "@/lib/referrals/server";
import {
  enforceMobileApiRateLimit,
  getBearerToken,
  mobileError,
  mobileNoStoreHeaders,
} from "@/lib/mobile-api";

export async function POST(request: Request) {
  const accessToken = getBearerToken(request);

  const rateLimitResponse =
    await enforceMobileApiRateLimit(
      request,
      "referrals.approve",
      accessToken,
    );

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  if (!accessToken) return mobileError(401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return mobileError();
  }

  const parsed = referralDecisionSchema.safeParse(body);
  if (!parsed.success) return mobileError();

  try {
    await approveReferral(
      parsed.data.referralId,
      parsed.data.operationId,
      accessToken,
    );
    return NextResponse.json({ ok: true }, { headers: mobileNoStoreHeaders });
  } catch {
    return mobileError(403);
  }
}
