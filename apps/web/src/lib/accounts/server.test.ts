import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  accountCreateSchema,
  accountRoleSchema,
  ownPasswordChangeSchema,
  usernamePasswordLoginSchema,
} from "@masjid-e-mamoor/validation";
import { APPLICATION_ROLES } from "@masjid-e-mamoor/types";

const repoFile = (path: string) => resolve(process.cwd(), "../..", path);

describe("account validation", () => {
  it("accepts username/password login payloads", () => {
    expect(
      usernamePasswordLoginSchema.parse({
        username: "member.user",
        password: "anything-submitted",
      }),
    ).toMatchObject({
      username: "member.user",
      password: "anything-submitted",
    });
  });

  it("requires strong own-password changes", () => {
    expect(
      ownPasswordChangeSchema.parse({
        password: "StrongPass1",
        confirmPassword: "StrongPass1",
      }).password,
    ).toBe("StrongPass1");

    expect(() =>
      ownPasswordChangeSchema.parse({
        password: "weak",
        confirmPassword: "weak",
      }),
    ).toThrow();

    expect(() =>
      ownPasswordChangeSchema.parse({
        password: "StrongPass1",
        confirmPassword: "StrongPass2",
      }),
    ).toThrow();
  });

  it("keeps system_admin out of normal account provisioning input", () => {
    expect(APPLICATION_ROLES).toContain("system_admin");
    expect(() => accountRoleSchema.parse("system_admin")).toThrow();

    expect(
      accountCreateSchema.parse({
        username: "finance.user",
        role: "finance",
      }).role,
    ).toBe("finance");
  });
});

describe("Auth V2 account administration security boundaries", () => {
  it("adds the System Admin role and account permissions in migration 025", () => {
    const migration = readFileSync(
      repoFile(
        "supabase/migrations/20260924131746_auth_v2_account_administration.sql",
      ),
      "utf8",
    );

    expect(migration).toContain("'system_admin'");
    expect(migration).toContain("'accounts.password.reset'");
    expect(migration).toContain("'accounts.president.manage'");
    expect(migration).toContain("'accounts.system_admin.manage'");
    expect(migration).toContain("account_security_events");
    expect(migration).toContain("must_change_password");
  });

  it("does not broaden direct application-user RLS through accounts.read", () => {
    const migration = readFileSync(
      repoFile(
        "supabase/migrations/20260924131746_auth_v2_account_administration.sql",
      ),
      "utf8",
    );

    expect(migration).toContain(
      "auth_user_id = auth.uid()\n  or public.has_application_permission('administration.users.manage')",
    );
    expect(migration).toContain(
      "revoke select on table public.application_users\n  from anon, authenticated;",
    );
    expect(migration).toContain(
      "last_username_changed_at\n) on table public.application_users\n  to authenticated;",
    );
    expect(migration).not.toContain(
      "or public.has_application_permission('accounts.read')\n);",
    );
    expect(migration).not.toContain(
      "or public.has_application_permission('accounts.role.manage')\n);",
    );
  });

  it("keeps service-role access in server-only code paths", () => {
    const adminClient = readFileSync(
      repoFile("apps/web/src/lib/supabase/admin.ts"),
      "utf8",
    );
    const loginPage = readFileSync(
      repoFile("apps/web/src/app/login/page.tsx"),
      "utf8",
    );

    expect(adminClient).toContain('import "server-only"');
    expect(adminClient).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(loginPage).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("uses username/password login instead of active phone OTP login", () => {
    const loginActions = readFileSync(
      repoFile("apps/web/src/app/login/actions.ts"),
      "utf8",
    );
    const loginPage = readFileSync(
      repoFile("apps/web/src/app/login/page.tsx"),
      "utf8",
    );

    expect(loginActions).toContain("signInWithPassword");
    expect(loginActions).not.toContain("signInWithOtp");
    expect(loginActions).not.toContain("verifyOtp");
    expect(loginPage).toContain("Username");
    expect(loginPage).not.toContain("Send OTP");
  });
});
