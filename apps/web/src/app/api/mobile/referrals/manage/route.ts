import { NextResponse } from "next/server";
import { listReferralOnboardingRequests } from "@/lib/referrals/server";
import {
  getBearerToken,
  mobileError,
  mobileNoStoreHeaders,
} from "@/lib/mobile-api";

export async function GET(request: Request) {
  const accessToken = getBearerToken(request);
  if (!accessToken) return mobileError(401);

  try {
    const referrals = await listReferralOnboardingRequests(accessToken);
    return NextResponse.json({ referrals }, { headers: mobileNoStoreHeaders });
  } catch {
    return mobileError(403);
  }
}
