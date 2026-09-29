import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  referralOnboardingSubmitSchema,
  referralProvisionSchema,
} from "@masjid-e-mamoor/validation";

const repoFile = (path: string) => resolve(process.cwd(), "../..", path);

describe("Referral onboarding V1 validation", () => {
  it("accepts public onboarding requests without account credentials", () => {
    const parsed = referralOnboardingSubmitSchema.parse({
      referralCode: "a".repeat(64),
      displayName: "New Member",
      phone: "+919876543210",
      operationId: "submit-1",
    });

    expect(parsed).toMatchObject({
      displayName: "New Member",
      phone: "+919876543210",
    });
    expect("password" in parsed).toBe(false);
    expect("role" in parsed).toBe(false);
  });

  it("keeps referral account provisioning fixed to username/password input only", () => {
    expect(
      referralProvisionSchema.parse({
        referralId: "11111111-1111-4111-8111-111111111111",
        username: "new.member",
        operationId: "complete-1",
      }).username,
    ).toBe("new.member");
  });
});

describe("Referral onboarding V1 security boundaries", () => {
  it("retires the old authenticated referral completion RPC", () => {
    const migration = readFileSync(
      repoFile(
        "supabase/migrations/20260928150216_referral_member_onboarding_v1_closure.sql",
      ),
      "utf8",
    );

    expect(migration).toContain("referral_registration_closed");
    expect(migration).toContain(
      "revoke all on function public.complete_referral_registration",
    );
    expect(migration).not.toContain(
      "grant execute on function public.complete_referral_registration",
    );
  });

  it("exposes only narrow public referral validation and submission functions", () => {
    const migration = readFileSync(
      repoFile(
        "supabase/migrations/20260928150216_referral_member_onboarding_v1_closure.sql",
      ),
      "utf8",
    );

    expect(migration).toContain("validate_referral_code");
    expect(migration).toContain("submit_referral_onboarding");
    expect(migration).toContain("to anon, authenticated");
    expect(migration).not.toContain("grant select on table public.referrals to anon");
    expect(migration).not.toContain("expires_at");
    expect(migration).not.toContain("'expired'");
  });

  it("does not create Auth/application accounts during public submission", () => {
    const migration = readFileSync(
      repoFile(
        "supabase/migrations/20260928150216_referral_member_onboarding_v1_closure.sql",
      ),
      "utf8",
    );
    const submitFunction = migration.slice(
      migration.indexOf("create or replace function public.submit_referral_onboarding"),
      migration.indexOf("create or replace function public.admin_approve_referral"),
    );

    expect(submitFunction).toContain("status = 'submitted'");
    expect(submitFunction).not.toContain("insert into public.application_users");
    expect(submitFunction).not.toContain("insert into public.member_profiles");
    expect(submitFunction).not.toContain("referred_application_user_id");
    expect(submitFunction).not.toContain("referred_member_profile_id");
  });

  it("keeps final referral provisioning on the Auth V2 member-account path", () => {
    const server = readFileSync(
      repoFile("apps/web/src/lib/referrals/server.ts"),
      "utf8",
    );

    expect(server).toContain("createAccount({");
    expect(server).toContain('role: "member"');
    expect(server).not.toContain("admin.auth.admin.createUser");
    expect(server).not.toContain("role: input");
  });
});
