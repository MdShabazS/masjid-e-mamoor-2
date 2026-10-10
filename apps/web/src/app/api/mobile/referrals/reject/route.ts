import { NextResponse } from "next/server";
import { referralRejectSchema } from "@masjid-e-mamoor/validation";
import { rejectReferral } from "@/lib/referrals/server";
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
      "referrals.reject",
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

  const parsed = referralRejectSchema.safeParse(body);
  if (!parsed.success) return mobileError();

  try {
    await rejectReferral(
      {
        referralId: parsed.data.referralId,
        reason: parsed.data.reason ?? null,
        operationId: parsed.data.operationId,
      },
      accessToken,
    );
    return NextResponse.json({ ok: true }, { headers: mobileNoStoreHeaders });
  } catch {
    return mobileError(403);
  }
}
