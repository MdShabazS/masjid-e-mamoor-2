import fs from "node:fs";
import path from "node:path";
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const rpcMock =
  vi.hoisted(
    () => vi.fn(),
  );

vi.mock(
  "@/lib/supabase/admin",
  () => ({
    createAdminClient: () => ({
      rpc: rpcMock,
    }),
  }),
);

import {
  enforceMobileApiRateLimit,
  getMobileClientNetworkIdentifier,
  getMobileRateLimitActorId,
  getMobileRateLimitActorSubjectHash,
  getMobileRateLimitNetworkSubjectHash,
} from "./mobile-rate-limit";

function jwtFor(
  sub: string,
) {
  const encode = (
    value: unknown,
  ) =>
    Buffer.from(
      JSON.stringify(value),
      "utf8",
    ).toString("base64url");

  return [
    encode({
      alg: "HS256",
      typ: "JWT",
    }),
    encode({
      sub,
      role: "authenticated",
    }),
    "signature",
  ].join(".");
}

const actorId =
  "00000000-0000-4000-8000-000000000111";

afterEach(() => {
  rpcMock.mockReset();
  vi.unstubAllEnvs();
});

describe(
  "mobile API distributed rate limiting",
  () => {
    it(
      "prefers Vercel client forwarding metadata and never returns a raw identifier as the stored subject",
      () => {
        const request =
          new Request(
            "https://example.test",
            {
              headers: {
                "x-vercel-forwarded-for":
                  "203.0.113.10",
                "x-forwarded-for":
                  "198.51.100.20",
              },
            },
          );

        expect(
          getMobileClientNetworkIdentifier(
            request,
          ),
        ).toBe(
          "203.0.113.10",
        );

        const hash =
          getMobileRateLimitNetworkSubjectHash(
            request,
          );

        expect(hash).toMatch(
          /^[0-9a-f]{64}$/,
        );

        expect(hash).not.toContain(
          "203.0.113.10",
        );
      },
    );

    it(
      "derives a stable authenticated actor subject from the JWT sub claim without storing the bearer token",
      () => {
        const token =
          jwtFor(actorId);

        expect(
          getMobileRateLimitActorId(
            token,
          ),
        ).toBe(actorId);

        const hash =
          getMobileRateLimitActorSubjectHash(
            token,
          );

        expect(hash).toMatch(
          /^[0-9a-f]{64}$/,
        );

        expect(hash).not.toContain(
          actorId,
        );

        expect(hash).not.toContain(
          token,
        );
      },
    );

    it(
      "rejects malformed or non-UUID JWT subjects for actor-scoped limiting",
      () => {
        expect(
          getMobileRateLimitActorId(
            "not-a-jwt",
          ),
        ).toBeNull();

        expect(
          getMobileRateLimitActorId(
            jwtFor(
              "attacker-controlled-string",
            ),
          ),
        ).toBeNull();
      },
    );

    it(
      "applies both network and actor limits to a bearer-authenticated endpoint",
      async () => {
        vi.stubEnv(
          "VITEST",
          "",
        );

        rpcMock
          .mockResolvedValueOnce({
            data: [
              {
                allowed: true,
                remaining: 49,
                retry_after_seconds: 0,
              },
            ],
            error: null,
          })
          .mockResolvedValueOnce({
            data: [
              {
                allowed: true,
                remaining: 9,
                retry_after_seconds: 0,
              },
            ],
            error: null,
          });

        const response =
          await enforceMobileApiRateLimit(
            new Request(
              "https://example.test",
              {
                headers: {
                  "x-vercel-forwarded-for":
                    "203.0.113.11",
                },
              },
            ),
            "accounts.reset-password",
            jwtFor(actorId),
          );

        expect(
          response,
        ).toBeNull();

        expect(
          rpcMock,
        ).toHaveBeenCalledTimes(
          2,
        );

        expect(
          rpcMock,
        ).toHaveBeenNthCalledWith(
          1,
          "consume_mobile_api_rate_limit",
          expect.objectContaining({
            p_bucket:
              "network:accounts.reset-password",
            p_limit: 50,
            p_window_seconds: 600,
            p_subject_hash:
              expect.stringMatching(
                /^[0-9a-f]{64}$/,
              ),
          }),
        );

        expect(
          rpcMock,
        ).toHaveBeenNthCalledWith(
          2,
          "consume_mobile_api_rate_limit",
          expect.objectContaining({
            p_bucket:
              "actor:accounts.reset-password",
            p_limit: 10,
            p_window_seconds: 600,
            p_subject_hash:
              expect.stringMatching(
                /^[0-9a-f]{64}$/,
              ),
          }),
        );
      },
    );

    it(
      "uses only the network limiter for the public login endpoint",
      async () => {
        vi.stubEnv(
          "VITEST",
          "",
        );

        rpcMock.mockResolvedValue({
          data: [
            {
              allowed: true,
              remaining: 19,
              retry_after_seconds: 0,
            },
          ],
          error: null,
        });

        const response =
          await enforceMobileApiRateLimit(
            new Request(
              "https://example.test",
              {
                headers: {
                  "x-vercel-forwarded-for":
                    "203.0.113.12",
                },
              },
            ),
            "auth.login",
          );

        expect(
          response,
        ).toBeNull();

        expect(
          rpcMock,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          rpcMock,
        ).toHaveBeenCalledWith(
          "consume_mobile_api_rate_limit",
          expect.objectContaining({
            p_bucket:
              "network:auth.login",
            p_limit: 20,
            p_window_seconds: 300,
          }),
        );
      },
    );

    it(
      "returns 429 with Retry-After when the authenticated actor limit is exhausted",
      async () => {
        vi.stubEnv(
          "VITEST",
          "",
        );

        rpcMock
          .mockResolvedValueOnce({
            data: [
              {
                allowed: true,
                remaining: 49,
                retry_after_seconds: 0,
              },
            ],
            error: null,
          })
          .mockResolvedValueOnce({
            data: [
              {
                allowed: false,
                remaining: 0,
                retry_after_seconds: 37,
              },
            ],
            error: null,
          });

        const response =
          await enforceMobileApiRateLimit(
            new Request(
              "https://example.test",
              {
                headers: {
                  "x-vercel-forwarded-for":
                    "203.0.113.13",
                },
              },
            ),
            "accounts.reset-password",
            jwtFor(actorId),
          );

        expect(
          response?.status,
        ).toBe(429);

        expect(
          response?.headers.get(
            "Retry-After",
          ),
        ).toBe("37");

        expect(
          response?.headers.get(
            "X-RateLimit-Limit",
          ),
        ).toBe("10");

        expect(
          response?.headers.get(
            "X-RateLimit-Remaining",
          ),
        ).toBe("0");

        expect(
          response?.headers.get(
            "Cache-Control",
          ),
        ).toBe("no-store");
      },
    );

    it(
      "stops at the network layer when the network limit is exhausted",
      async () => {
        vi.stubEnv(
          "VITEST",
          "",
        );

        rpcMock.mockResolvedValueOnce({
          data: [
            {
              allowed: false,
              remaining: 0,
              retry_after_seconds: 22,
            },
          ],
          error: null,
        });

        const response =
          await enforceMobileApiRateLimit(
            new Request(
              "https://example.test",
              {
                headers: {
                  "x-vercel-forwarded-for":
                    "203.0.113.14",
                },
              },
            ),
            "accounts.create",
            jwtFor(actorId),
          );

        expect(
          response?.status,
        ).toBe(429);

        expect(
          rpcMock,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          response?.headers.get(
            "X-RateLimit-Limit",
          ),
        ).toBe("100");
      },
    );

    it(
      "fails closed with no-store 503 when the distributed limiter backend cannot be evaluated",
      async () => {
        vi.stubEnv(
          "VITEST",
          "",
        );

        rpcMock.mockResolvedValue({
          data: null,
          error: {
            message:
              "database unavailable",
          },
        });

        const response =
          await enforceMobileApiRateLimit(
            new Request(
              "https://example.test",
            ),
            "accounts.list",
            jwtFor(actorId),
          );

        expect(
          response?.status,
        ).toBe(503);

        expect(
          response?.headers.get(
            "Cache-Control",
          ),
        ).toBe("no-store");
      },
    );

    it(
      "wires all routes and passes bearer credentials to every authenticated limiter call",
      () => {
        const routes = {
          "src/app/api/mobile/accounts/change-role/route.ts":
            {
              bucket:
                "accounts.change-role",
              authenticated: true,
            },
          "src/app/api/mobile/accounts/change-status/route.ts":
            {
              bucket:
                "accounts.change-status",
              authenticated: true,
            },
          "src/app/api/mobile/accounts/change-username/route.ts":
            {
              bucket:
                "accounts.change-username",
              authenticated: true,
            },
          "src/app/api/mobile/accounts/create/route.ts":
            {
              bucket:
                "accounts.create",
              authenticated: true,
            },
          "src/app/api/mobile/accounts/reset-password/route.ts":
            {
              bucket:
                "accounts.reset-password",
              authenticated: true,
            },
          "src/app/api/mobile/accounts/route.ts":
            {
              bucket:
                "accounts.list",
              authenticated: true,
            },
          "src/app/api/mobile/auth/change-password/route.ts":
            {
              bucket:
                "auth.change-password",
              authenticated: true,
            },
          "src/app/api/mobile/auth/login/route.ts":
            {
              bucket:
                "auth.login",
              authenticated: false,
            },
          "src/app/api/mobile/referrals/approve/route.ts":
            {
              bucket:
                "referrals.approve",
              authenticated: true,
            },
          "src/app/api/mobile/referrals/manage/route.ts":
            {
              bucket:
                "referrals.manage",
              authenticated: true,
            },
          "src/app/api/mobile/referrals/provision/route.ts":
            {
              bucket:
                "referrals.provision",
              authenticated: true,
            },
          "src/app/api/mobile/referrals/reject/route.ts":
            {
              bucket:
                "referrals.reject",
              authenticated: true,
            },
        } as const;

        for (
          const [
            relativePath,
            configuration,
          ] of Object.entries(
            routes,
          )
        ) {
          const source =
            fs.readFileSync(
              path.join(
                process.cwd(),
                relativePath,
              ),
              "utf8",
            );

          expect(
            source,
          ).toContain(
            "enforceMobileApiRateLimit",
          );

          expect(
            source,
          ).toContain(
            `"${configuration.bucket}"`,
          );

          if (
            configuration.authenticated
          ) {
            expect(
              source,
            ).toMatch(
              new RegExp(
                `enforceMobileApiRateLimit\\([\\s\\S]{0,250}"${configuration.bucket.replace(
                  ".",
                  "\\.",
                )}"[\\s\\S]{0,120}accessToken`,
              ),
            );
          }
        }
      },
    );
  },
);
