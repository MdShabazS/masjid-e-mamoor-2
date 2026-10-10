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
  getMobileRateLimitSubjectHash,
} from "./mobile-rate-limit";

afterEach(() => {
  rpcMock.mockReset();
  vi.unstubAllEnvs();
});

describe(
  "mobile API distributed rate limiting",
  () => {
    it(
      "uses the first forwarded client address without storing it raw",
      () => {
        const request =
          new Request(
            "https://example.test",
            {
              headers: {
                "x-forwarded-for":
                  "203.0.113.10, 10.0.0.1",
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
          getMobileRateLimitSubjectHash(
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
      "allows a request when the distributed counter allows it",
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
                  "x-forwarded-for":
                    "203.0.113.11",
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
              "auth.login",
            p_limit: 20,
            p_window_seconds: 300,
            p_subject_hash:
              expect.stringMatching(
                /^[0-9a-f]{64}$/,
              ),
          }),
        );
      },
    );

    it(
      "returns no-store 429 with Retry-After after the limit is exhausted",
      async () => {
        vi.stubEnv(
          "VITEST",
          "",
        );

        rpcMock.mockResolvedValue({
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
                  "x-forwarded-for":
                    "203.0.113.12",
                },
              },
            ),
            "accounts.reset-password",
          );

        expect(
          response?.status,
        ).toBe(429);

        expect(
          response?.headers.get(
            "Cache-Control",
          ),
        ).toBe("no-store");

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
      },
    );

    it(
      "fails closed when the limiter backend cannot be evaluated",
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
      "wires every custom mobile API route through the limiter",
      () => {
        const routes = {
          "src/app/api/mobile/accounts/change-role/route.ts":
            "accounts.change-role",
          "src/app/api/mobile/accounts/change-status/route.ts":
            "accounts.change-status",
          "src/app/api/mobile/accounts/change-username/route.ts":
            "accounts.change-username",
          "src/app/api/mobile/accounts/create/route.ts":
            "accounts.create",
          "src/app/api/mobile/accounts/reset-password/route.ts":
            "accounts.reset-password",
          "src/app/api/mobile/accounts/route.ts":
            "accounts.list",
          "src/app/api/mobile/auth/change-password/route.ts":
            "auth.change-password",
          "src/app/api/mobile/auth/login/route.ts":
            "auth.login",
          "src/app/api/mobile/referrals/approve/route.ts":
            "referrals.approve",
          "src/app/api/mobile/referrals/manage/route.ts":
            "referrals.manage",
          "src/app/api/mobile/referrals/provision/route.ts":
            "referrals.provision",
          "src/app/api/mobile/referrals/reject/route.ts":
            "referrals.reject",
        } as const;

        for (
          const [
            relativePath,
            bucket,
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
            `"${bucket}"`,
          );
        }
      },
    );
  },
);
