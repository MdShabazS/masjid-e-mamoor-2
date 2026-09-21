import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  adminMemberProfileUpdateSchema,
  adminMemberStatusChangeSchema,
  memberDisplayNameSchema,
  memberPhoneSchema,
  ownMemberProfileUpdateSchema,
} from "@masjid-e-mamoor/validation";

const repoFile = (path: string) => resolve(process.cwd(), "../..", path);

describe("member validation", () => {
  it("normalizes a valid member name", () => {
    expect(memberDisplayNameSchema.parse("  Abdul Rahman  ")).toBe(
      "Abdul Rahman",
    );
  });

  it("rejects an empty member name", () => {
    expect(() => memberDisplayNameSchema.parse("")).toThrow();
    expect(() => memberDisplayNameSchema.parse("   ")).toThrow();
  });

  it("validates optional phone values without allowing local-only numbers", () => {
    expect(memberPhoneSchema.parse("+919876543210")).toBe("+919876543210");
    expect(memberPhoneSchema.parse(null)).toBeNull();
    expect(() => memberPhoneSchema.parse("9876543210")).toThrow();
  });

  it("accepts an own-profile update payload for permitted self-service fields only", () => {
    expect(
      ownMemberProfileUpdateSchema.parse({
        displayName: "  Abdul Rahman  ",
        phone: null,
        operationId: "op-123",
      }),
    ).toEqual({
      displayName: "Abdul Rahman",
      phone: null,
      operationId: "op-123",
    });
  });

  it("accepts an admin member update payload", () => {
    expect(
      adminMemberProfileUpdateSchema.parse({
        memberProfileId: "11111111-1111-4111-8111-111111111111",
        displayName: "Abdul Rahman",
        phone: "+919876543210",
        operationId: "op-123",
        reason: null,
      }),
    ).toMatchObject({
      displayName: "Abdul Rahman",
      phone: "+919876543210",
    });
  });

  it("restricts status changes to active/inactive", () => {
    expect(() =>
      adminMemberStatusChangeSchema.parse({
        memberProfileId: "11111111-1111-4111-8111-111111111111",
        status: "pending",
        operationId: "op-123",
        reason: null,
      }),
    ).toThrow();
  });
});

describe("member management SQL security boundaries", () => {
  it("keeps administrative member reads behind the approved role boundary", () => {
    const migration = readFileSync(
      repoFile(
        "supabase/migrations/20260921032000_member_admin_read_role_boundary.sql",
      ),
      "utf8",
    );

    expect(migration).toContain("can_use_member_admin_read_operations");
    expect(migration).toContain("'president'");
    expect(migration).toContain("'vice_president'");
    expect(migration).toContain("'secretary'");
    expect(migration).toContain("'finance'");
    expect(migration).toContain("'auditor'");
    expect(migration).not.toMatch(
      /current_application_role\(\) in \([\s\S]*'committee_member'/,
    );
    expect(migration).not.toMatch(
      /current_application_role\(\) in \([\s\S]*'member'/,
    );
    expect(migration).toMatch(
      /if not public\.can_use_member_admin_read_operations\(\) then/,
    );
  });

  it("keeps direct client writes closed for protected member records", () => {
    const memberProfiles = readFileSync(
      repoFile(
        "supabase/migrations/20260921021000_member_client_write_boundary.sql",
      ),
      "utf8",
    );
    const historyAndReferrals = readFileSync(
      repoFile(
        "supabase/migrations/20260921031000_member_client_write_privilege_hardening.sql",
      ),
      "utf8",
    );

    expect(memberProfiles).toMatch(
      /revoke insert, update, delete\s+on public\.member_profiles\s+from anon, authenticated;/,
    );
    expect(historyAndReferrals).toMatch(
      /revoke all privileges on table public\.membership_history\s+from anon, authenticated;/,
    );
    expect(historyAndReferrals).toMatch(
      /revoke all privileges on table public\.referrals\s+from anon, authenticated;/,
    );
  });

  it("hardens trusted member mutations with server validation and scoped idempotency", () => {
    const migration = readFileSync(
      repoFile(
        "supabase/migrations/20260921154530_member_management_v1_hardening.sql",
      ),
      "utf8",
    );

    expect(migration).toContain("invalid_display_name");
    expect(migration).toContain("invalid_phone");
    expect(migration).toContain("operation_id_conflict");
    expect(migration).toContain("member_profiles_display_name_v1_chk");
    expect(migration).toContain("member_profiles_phone_v1_chk");
    expect(migration).toMatch(/v_history\.event_type = 'profile_updated'/);
    expect(migration).toMatch(/v_history\.event_type = 'status_changed'/);
    expect(migration).toMatch(/v_history\.member_profile_id = p_member_profile_id/);
  });
});
