import { NextResponse } from "next/server";
import { accountPasswordResetSchema } from "@masjid-e-mamoor/validation";
import { resetAccountPassword } from "@/lib/accounts/server";
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
      "accounts.reset-password",
      accessToken,
    );

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  if (!accessToken) return mobileError(401);

  const parsed = accountPasswordResetSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return mobileError(400);

  try {
    const temporaryPassword = await resetAccountPassword(
      parsed.data.accountId,
      parsed.data.password,
      accessToken,
    );
    return NextResponse.json(
      { temporaryPassword },
      { headers: mobileNoStoreHeaders },
    );
  } catch {
    return mobileError(403);
  }
}
