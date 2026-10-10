import { NextResponse } from "next/server";
import { usernamePasswordLoginSchema } from "@masjid-e-mamoor/validation";
import { getLoginAccountByUsername } from "@/lib/accounts/server";
import { createMobileAuthClient } from "@/lib/supabase/mobile-auth";
import { enforceMobileApiRateLimit } from "@/lib/mobile-rate-limit";

const noStoreHeaders = { "Cache-Control": "no-store" };

function invalidCredentials() {
  return NextResponse.json(
    { error: "invalid_credentials" },
    { status: 401, headers: noStoreHeaders },
  );
}

export async function POST(request: Request) {
  const rateLimitResponse =
    await enforceMobileApiRateLimit(
      request,
      "auth.login",
    );

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return invalidCredentials();
  }

  const parsed = usernamePasswordLoginSchema.safeParse(body);
  if (!parsed.success) return invalidCredentials();

  try {
    const account = await getLoginAccountByUsername(parsed.data.username);
    if (!account || account.status !== "active") return invalidCredentials();

    const supabase = createMobileAuthClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: account.authLoginEmail,
      password: parsed.data.password,
    });

    if (
      error ||
      !data.session ||
      !data.user ||
      data.user.id !== account.authUserId
    ) {
      await supabase.auth.signOut();
      return invalidCredentials();
    }

    return NextResponse.json(
      {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at ?? null,
        expiresIn: data.session.expires_in,
        mustChangePassword: account.mustChangePassword,
      },
      { headers: noStoreHeaders },
    );
  } catch {
    return invalidCredentials();
  }
}
