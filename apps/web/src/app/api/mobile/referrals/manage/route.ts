import { NextResponse } from "next/server";
import { listReferralOnboardingRequests } from "@/lib/referrals/server";
import {
  enforceMobileApiRateLimit,
  getBearerToken,
  mobileError,
  mobileNoStoreHeaders,
} from "@/lib/mobile-api";

export async function GET(request: Request) {
  const accessToken = getBearerToken(request);

  const rateLimitResponse =
    await enforceMobileApiRateLimit(
      request,
      "referrals.manage",
      accessToken,
    );

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  if (!accessToken) return mobileError(401);

  try {
    const referrals = await listReferralOnboardingRequests(accessToken);
    return NextResponse.json({ referrals }, { headers: mobileNoStoreHeaders });
  } catch {
    return mobileError(403);
  }
}
