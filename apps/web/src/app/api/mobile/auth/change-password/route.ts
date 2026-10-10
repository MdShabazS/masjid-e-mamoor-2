import { NextResponse } from "next/server";
import { ownPasswordChangeSchema } from "@masjid-e-mamoor/validation";
import { changePasswordWithAccessToken } from "@/lib/accounts/server";
import { enforceMobileApiRateLimit } from "@/lib/mobile-rate-limit";

const noStoreHeaders = { "Cache-Control": "no-store" };

function safeError(status = 400) {
  return NextResponse.json(
    { error: "password_change_failed" },
    { status, headers: noStoreHeaders },
  );
}

export async function POST(request: Request) {
  const rateLimitResponse =
    await enforceMobileApiRateLimit(
      request,
      "auth.change-password",
    );

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return safeError(401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return safeError();
  }

  const parsed = ownPasswordChangeSchema.safeParse(body);
  if (!parsed.success) return safeError();

  try {
    await changePasswordWithAccessToken(match[1], parsed.data.password);
    return NextResponse.json(
      { ok: true },
      { headers: noStoreHeaders },
    );
  } catch {
    return safeError(401);
  }
}
