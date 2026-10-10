import "server-only";

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const mobileRateLimitPolicies = {
  "auth.login": {
    limit: 20,
    windowSeconds: 300,
  },
  "auth.change-password": {
    limit: 10,
    windowSeconds: 600,
  },
  "accounts.list": {
    limit: 120,
    windowSeconds: 60,
  },
  "accounts.create": {
    limit: 20,
    windowSeconds: 300,
  },
  "accounts.change-role": {
    limit: 30,
    windowSeconds: 300,
  },
  "accounts.change-status": {
    limit: 30,
    windowSeconds: 300,
  },
  "accounts.change-username": {
    limit: 30,
    windowSeconds: 300,
  },
  "accounts.reset-password": {
    limit: 10,
    windowSeconds: 600,
  },
  "referrals.manage": {
    limit: 120,
    windowSeconds: 60,
  },
  "referrals.approve": {
    limit: 30,
    windowSeconds: 300,
  },
  "referrals.reject": {
    limit: 30,
    windowSeconds: 300,
  },
  "referrals.provision": {
    limit: 20,
    windowSeconds: 300,
  },
} as const;

export type MobileRateLimitBucket =
  keyof typeof mobileRateLimitPolicies;

type RateLimitRow = {
  allowed: boolean;
  remaining: number;
  retry_after_seconds: number;
};

function firstHeaderValue(
  value: string | null,
) {
  if (!value) return null;

  const first =
    value
      .split(",")[0]
      ?.trim();

  return first || null;
}

export function getMobileClientNetworkIdentifier(
  request: Request,
) {
  return (
    firstHeaderValue(
      request.headers.get("x-forwarded-for"),
    ) ??
    firstHeaderValue(
      request.headers.get("x-real-ip"),
    ) ??
    firstHeaderValue(
      request.headers.get("cf-connecting-ip"),
    ) ??
    "unknown"
  );
}

export function getMobileRateLimitSubjectHash(
  request: Request,
) {
  const networkIdentifier =
    getMobileClientNetworkIdentifier(
      request,
    );

  return createHash("sha256")
    .update(
      `mobile-api-ip:${networkIdentifier}`,
      "utf8",
    )
    .digest("hex");
}

function unavailableResponse() {
  return NextResponse.json(
    {
      error: "request_failed",
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function limitedResponse(
  policy: {
    limit: number;
    windowSeconds: number;
  },
  row: RateLimitRow,
) {
  const retryAfter =
    Math.max(
      1,
      Math.trunc(
        row.retry_after_seconds,
      ),
    );

  return NextResponse.json(
    {
      error: "request_failed",
    },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(
          retryAfter,
        ),
        "X-RateLimit-Limit": String(
          policy.limit,
        ),
        "X-RateLimit-Remaining":
          String(
            Math.max(
              0,
              Math.trunc(
                row.remaining,
              ),
            ),
          ),
      },
    },
  );
}

export async function enforceMobileApiRateLimit(
  request: Request,
  bucket: MobileRateLimitBucket,
) {
  if (process.env.VITEST) {
    return null;
  }

  const policy =
    mobileRateLimitPolicies[bucket];

  try {
    const admin =
      createAdminClient();

    const {
      data,
      error,
    } = await admin.rpc(
      "consume_mobile_api_rate_limit",
      {
        p_bucket: bucket,
        p_subject_hash:
          getMobileRateLimitSubjectHash(
            request,
          ),
        p_limit:
          policy.limit,
        p_window_seconds:
          policy.windowSeconds,
      },
    );

    if (error) {
      return unavailableResponse();
    }

    const row =
      Array.isArray(data)
        ? data[0]
        : data;

    if (
      !row ||
      typeof row.allowed !==
        "boolean" ||
      typeof row.remaining !==
        "number" ||
      typeof row.retry_after_seconds !==
        "number"
    ) {
      return unavailableResponse();
    }

    const result =
      row as RateLimitRow;

    if (result.allowed) {
      return null;
    }

    return limitedResponse(
      policy,
      result,
    );
  } catch {
    return unavailableResponse();
  }
}
