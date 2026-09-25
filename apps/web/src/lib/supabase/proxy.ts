import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },

      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });

        Object.entries(headers ?? {}).forEach(([name, value]) => {
          response.headers.set(name, value);
        });
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims?.sub) {
    return response;
  }

  const pathname = request.nextUrl.pathname;
  const isLogin = pathname === "/login";
  const isChangePassword = pathname === "/change-password";

  const { data: account } = await supabase
    .from("application_users")
    .select("status, must_change_password")
    .eq("auth_user_id", claims.sub)
    .maybeSingle();

  if (!account || account.status !== "active") {
    if (isLogin) return response;

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "?error=invalid_credentials";
    return NextResponse.redirect(redirectUrl);
  }

  if (account.must_change_password && !isChangePassword) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/change-password";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (!account.must_change_password && isChangePassword) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
