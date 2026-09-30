import { NextResponse } from "next/server";
import { accountUsernameChangeSchema } from "@masjid-e-mamoor/validation";
import { changeAccountUsername } from "@/lib/accounts/server";
import {
  getBearerToken,
  mobileError,
  mobileNoStoreHeaders,
} from "@/lib/mobile-api";

export async function POST(request: Request) {
  const accessToken = getBearerToken(request);
  if (!accessToken) return mobileError(401);

  const parsed = accountUsernameChangeSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return mobileError(400);

  try {
    await changeAccountUsername(
      parsed.data.accountId,
      parsed.data.username,
      accessToken,
    );
    return NextResponse.json(
      { updated: true },
      { headers: mobileNoStoreHeaders },
    );
  } catch {
    return mobileError(403);
  }
}
