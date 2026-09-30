import { NextResponse } from "next/server";
import { accountRoleChangeSchema } from "@masjid-e-mamoor/validation";
import { changeAccountRole } from "@/lib/accounts/server";
import {
  getBearerToken,
  mobileError,
  mobileNoStoreHeaders,
} from "@/lib/mobile-api";

export async function POST(request: Request) {
  const accessToken = getBearerToken(request);
  if (!accessToken) return mobileError(401);

  const parsed = accountRoleChangeSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return mobileError(400);

  try {
    await changeAccountRole(
      parsed.data.accountId,
      parsed.data.role,
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
