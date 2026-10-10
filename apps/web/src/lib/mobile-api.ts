import "server-only";

import { NextResponse } from "next/server";

export { getBearerToken } from "./mobile-auth-input";
export { enforceMobileApiRateLimit } from "./mobile-rate-limit";

export const mobileNoStoreHeaders = { "Cache-Control": "no-store" };

export function mobileError(status = 400) {
  return NextResponse.json(
    { error: "request_failed" },
    { status, headers: mobileNoStoreHeaders },
  );
}
