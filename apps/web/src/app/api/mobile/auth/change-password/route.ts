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
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const accessToken = match?.[1]?.trim() ?? null;

  const rateLimitResponse =
    await enforceMobileApiRateLimit(
      request,
      "auth.change-password",
      accessToken,
    );

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  if (!accessToken) return safeError(401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return safeError();
  }

  const parsed = ownPasswordChangeSchema.safeParse(body);
  if (!parsed.success) return safeError();

  try {
    await changePasswordWithAccessToken(accessToken, parsed.data.password);
    return NextResponse.json(
      { ok: true },
      { headers: noStoreHeaders },
    );
  } catch {
    return safeError(401);
  }
}
