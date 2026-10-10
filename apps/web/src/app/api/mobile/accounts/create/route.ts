import { NextResponse } from "next/server";
import { accountCreateSchema } from "@masjid-e-mamoor/validation";
import { createAccount } from "@/lib/accounts/server";
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
      "accounts.create",
      accessToken,
    );

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  if (!accessToken) return mobileError(401);

  const parsed = accountCreateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return mobileError(400);

  try {
    const result = await createAccount(parsed.data, accessToken);
    return NextResponse.json(result, { headers: mobileNoStoreHeaders });
  } catch {
    return mobileError(403);
  }
}
