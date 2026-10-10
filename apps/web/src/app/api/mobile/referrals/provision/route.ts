import { NextResponse } from "next/server";
import { referralProvisionSchema } from "@masjid-e-mamoor/validation";
import { completeReferralProvisioning } from "@/lib/referrals/server";
import {
  enforceMobileApiRateLimit,
  getBearerToken,
  mobileError,
  mobileNoStoreHeaders,
} from "@/lib/mobile-api";

export async function POST(request: Request) {
  const rateLimitResponse =
    await enforceMobileApiRateLimit(
      request,
      "referrals.provision",
    );

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const accessToken = getBearerToken(request);
  if (!accessToken) return mobileError(401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return mobileError();
  }

  const parsed = referralProvisionSchema.safeParse(body);
  if (!parsed.success) return mobileError();

  try {
    const result = await completeReferralProvisioning(
      {
        referralId: parsed.data.referralId,
        username: parsed.data.username,
        password: parsed.data.password,
        operationId: parsed.data.operationId,
      },
      accessToken,
    );
    return NextResponse.json(
      { temporaryPassword: result.temporaryPassword },
      { headers: mobileNoStoreHeaders },
    );
  } catch {
    return mobileError(403);
  }
}
