import { NextResponse } from "next/server";
import { listAccounts } from "@/lib/accounts/server";
import { toMobileManagedAccount } from "@/lib/mobile-account-api";
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
      "accounts.list",
      accessToken,
    );

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  if (!accessToken) return mobileError(401);

  try {
    const accounts = await listAccounts(accessToken);
    return NextResponse.json(
      { accounts: accounts.map(toMobileManagedAccount) },
      { headers: mobileNoStoreHeaders },
    );
  } catch {
    return mobileError(403);
  }
}
