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

  it("requires at least 8 characters for own-password changes", () => {
    expect(
      ownPasswordChangeSchema.parse({
        password: "12345678",
        confirmPassword: "12345678",
      }).password,
    ).toBe("12345678");

    expect(
      ownPasswordChangeSchema.parse({
        password: "abcdefgh",
        confirmPassword: "abcdefgh",
      }).password,
    ).toBe("abcdefgh");

    expect(() =>
      ownPasswordChangeSchema.parse({
        password: "1234567",
        confirmPassword: "1234567",
      }),
    ).toThrow();

    expect(() =>
      ownPasswordChangeSchema.parse({
        password: "12345678",
        confirmPassword: "87654321",
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
        displayName: "Finance User",
      }).role,
    ).toBe("finance");

    expect(() =>
      accountCreateSchema.parse({
        username: "finance.user",
        role: "finance",
      }),
    ).toThrow();
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

  it("keeps mobile bearer authorization inside the trusted account server", () => {
    const server = readFileSync(
      repoFile("apps/web/src/lib/accounts/server.ts"),
      "utf8",
    );

    expect(server).toContain("export async function listAccounts(accessToken?: string)");
    expect(server).toContain("const actor = await requireCurrentAccount(accessToken)");
    expect(server).toContain("accessToken?: string,\n) {\n  const actor = await requireCurrentAccount(accessToken)");
    expect(server).toContain("assertCanManageAccount(actor, target)");
    expect(server).toContain("assertCanCreateRole(actor, role)");
  });

  it("uses the trusted admin client for mobile password changes", () => {
    const server = readFileSync(
      repoFile("apps/web/src/lib/accounts/server.ts"),
      "utf8",
    );

    const start = server.indexOf(
      "export async function changePasswordWithAccessToken",
    );
    const nextExport = server.indexOf("\nexport ", start + 1);
    const mobilePasswordChange = server.slice(
      start,
      nextExport === -1 ? server.length : nextExport,
    );

    expect(start).toBeGreaterThanOrEqual(0);
    expect(mobilePasswordChange).toMatch(
      /await\s+supabase\.auth\.getUser\(\s*accessToken,?\s*\)/,
    );
    expect(mobilePasswordChange).toContain(
      "admin.auth.admin.updateUserById(",
    );
    expect(mobilePasswordChange).not.toContain(
      "await supabase.auth.updateUser({ password })",
    );
  });

  it("preserves President and System Admin account boundaries", () => {
    const server = readFileSync(
      repoFile("apps/web/src/lib/accounts/server.ts"),
      "utf8",
    );

    expect(server).toContain('if (role === "system_admin")');
    expect(server).toContain('if (actor.role === "president")');
    expect(server).toContain("assertPresidentCanManageRole(target.role)");
    expect(server).toContain("target.id === actor.id || (await countActiveSystemAdmins()) <= 1");
    expect(server).toContain("target.id === actor.id &&\n    status === \"deactivated\"");
    expect(server).toContain("(await countActiveSystemAdmins()) <= 1");
  });

  it("persists an account display name without using the username as a fallback", () => {
    const server = readFileSync(
      repoFile("apps/web/src/lib/accounts/server.ts"),
      "utf8",
    );
    const migration = readFileSync(
      repoFile(
        "supabase/migrations/20261002202358_application_user_display_names.sql",
      ),
      "utf8",
    );

    expect(server).toContain("display_name: displayName");
    expect(server).toContain('if (input.role === "member")');
    expect(server).not.toContain(
      "input.displayName?.trim() || input.username.trim()",
    );
    expect(migration).toMatch(
      /update public\.application_users au\s+set display_name = btrim\(mp\.display_name\)/,
    );
  });
});
