import "server-only";

import { Buffer } from "node:buffer";
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

type RateLimitPolicy = {
  limit: number;
  windowSeconds: number;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
      request.headers.get(
        "x-vercel-forwarded-for",
      ),
    ) ??
    firstHeaderValue(
      request.headers.get(
        "x-forwarded-for",
      ),
    ) ??
    firstHeaderValue(
      request.headers.get(
        "x-real-ip",
      ),
    ) ??
    firstHeaderValue(
      request.headers.get(
        "cf-connecting-ip",
      ),
    ) ??
    "unknown"
  );
}

function sha256(
  value: string,
) {
  return createHash("sha256")
    .update(
      value,
      "utf8",
    )
    .digest("hex");
}

export function getMobileRateLimitNetworkSubjectHash(
  request: Request,
) {
  return sha256(
    `mobile-api-network:${getMobileClientNetworkIdentifier(
      request,
    )}`,
  );
}

export function getMobileRateLimitActorId(
  accessToken: string,
) {
  try {
    const parts =
      accessToken.split(".");

    if (
      parts.length !== 3 ||
      !parts[1]
    ) {
      return null;
    }

    const decoded =
      Buffer.from(
        parts[1],
        "base64url",
      ).toString("utf8");

    const payload =
      JSON.parse(decoded) as {
        sub?: unknown;
      };

    if (
      typeof payload.sub !==
        "string" ||
      !uuidPattern.test(
        payload.sub,
      )
    ) {
      return null;
    }

    return payload.sub.toLowerCase();
  } catch {
    return null;
  }
}

export function getMobileRateLimitActorSubjectHash(
  accessToken: string,
) {
  const actorId =
    getMobileRateLimitActorId(
      accessToken,
    );

  if (!actorId) {
    return null;
  }

  return sha256(
    `mobile-api-actor:${actorId}`,
  );
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
  limit: number,
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
        "X-RateLimit-Limit":
          String(limit),
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

async function consumeRateLimit(
  admin: ReturnType<
    typeof createAdminClient
  >,
  input: {
    bucket: string;
    subjectHash: string;
    limit: number;
    windowSeconds: number;
  },
) {
  const {
    data,
    error,
  } = await admin.rpc(
    "consume_mobile_api_rate_limit",
    {
      p_bucket:
        input.bucket,
      p_subject_hash:
        input.subjectHash,
      p_limit:
        input.limit,
      p_window_seconds:
        input.windowSeconds,
    },
  );

  if (error) {
    throw new Error(
      "rate_limit_backend_failed",
    );
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
    throw new Error(
      "rate_limit_backend_invalid",
    );
  }

  return row as RateLimitRow;
}

function networkPolicy(
  policy: RateLimitPolicy,
  hasBearerCredential: boolean,
) {
  return {
    limit:
      hasBearerCredential
        ? Math.min(
            policy.limit * 5,
            10000,
          )
        : policy.limit,
    windowSeconds:
      policy.windowSeconds,
  };
}

export async function enforceMobileApiRateLimit(
  request: Request,
  bucket: MobileRateLimitBucket,
  accessToken?: string | null,
) {
  if (process.env.VITEST) {
    return null;
  }

  const policy =
    mobileRateLimitPolicies[bucket];

  try {
    const admin =
      createAdminClient();

    const outer =
      networkPolicy(
        policy,
        Boolean(accessToken),
      );

    const networkResult =
      await consumeRateLimit(
        admin,
        {
          bucket:
            `network:${bucket}`,
          subjectHash:
            getMobileRateLimitNetworkSubjectHash(
              request,
            ),
          limit:
            outer.limit,
          windowSeconds:
            outer.windowSeconds,
        },
      );

    if (
      !networkResult.allowed
    ) {
      return limitedResponse(
        outer.limit,
        networkResult,
      );
    }

    if (!accessToken) {
      return null;
    }

    const actorSubjectHash =
      getMobileRateLimitActorSubjectHash(
        accessToken,
      );

    if (!actorSubjectHash) {
      return null;
    }

    const actorResult =
      await consumeRateLimit(
        admin,
        {
          bucket:
            `actor:${bucket}`,
          subjectHash:
            actorSubjectHash,
          limit:
            policy.limit,
          windowSeconds:
            policy.windowSeconds,
        },
      );

    if (
      !actorResult.allowed
    ) {
      return limitedResponse(
        policy.limit,
        actorResult,
      );
    }

    return null;
  } catch {
    return unavailableResponse();
  }
}
