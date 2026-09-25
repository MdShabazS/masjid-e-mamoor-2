import Link from "next/link";
import { redirect } from "next/navigation";
import {
  canManageAccounts,
  getCurrentAccount,
  listAccounts,
} from "@/lib/accounts/server";
import {
  changeRoleAction,
  changeStatusAction,
  changeUsernameAction,
} from "./actions";
import {
  CreateAccountForm,
  OwnUsernameForm,
  ResetPasswordForm,
} from "./AccountAdminForms";

type AccountsPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

const normalRoles = [
  ["member", "Member"],
  ["committee_member", "Committee Member"],
  ["auditor", "Auditor"],
  ["finance", "Finance"],
  ["secretary", "Secretary"],
  ["vice_president", "Vice President"],
] as const;

const systemAdminRoles = [
  ...normalRoles,
  ["president", "President"],
] as const;

export default async function AccountsPage({
  searchParams,
}: AccountsPageProps) {
  if (!(await canManageAccounts())) {
    redirect("/dashboard");
  }

  const [params, accounts, actor] = await Promise.all([
    searchParams,
    listAccounts(),
    getCurrentAccount(),
  ]);
  const roleOptions =
    actor?.role === "system_admin" ? systemAdminRoles : normalRoles;

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-start justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-zinc-500">
              Masjid-e-Mamoor
            </p>
            <h1 className="mt-1 text-3xl font-semibold">
              Account administration
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              Provision users, assign authorized roles, and reset
              temporary passwords.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
          >
            Dashboard
          </Link>
        </header>

        {params.error ? (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Account change could not be completed.
          </div>
        ) : null}

        <div className="mt-8">
          <OwnUsernameForm username={actor?.username ?? null} />
        </div>

        <div className="mt-8">
          <CreateAccountForm allowPresident={actor?.role === "system_admin"} />
        </div>

        <section className="mt-8 rounded-2xl border border-black/10 bg-white p-6">
          <h2 className="text-lg font-semibold">Accounts</h2>
          <div className="mt-5 space-y-4">
            {accounts.map((account) => (
              <article
                key={account.id}
                className="rounded-lg border border-zinc-200 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="font-medium">
                      {account.username ?? "No username"}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-600">
                      {account.displayName ?? account.id}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {account.role} · {account.status}
                      {account.mustChangePassword
                        ? " · password change required"
                        : ""}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <form
                    action={changeUsernameAction}
                    className="flex flex-wrap items-end gap-3"
                  >
                    <input
                      name="accountId"
                      type="hidden"
                      value={account.id}
                    />
                    <label className="text-sm font-medium">
                      Username
                      <input
                        name="username"
                        defaultValue={account.username ?? ""}
                        required
                        className="mt-1 w-56 rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-900"
                      />
                    </label>
                    <button
                      type="submit"
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50"
                    >
                      Save
                    </button>
                  </form>

                  {account.role === "system_admin" ? (
                    <div className="text-sm text-zinc-600">
                      <span className="font-medium text-zinc-900">
                        Role
                      </span>
                      <p className="mt-1">System Admin</p>
                    </div>
                  ) : (
                    <form
                      action={changeRoleAction}
                      className="flex flex-wrap items-end gap-3"
                    >
                      <input
                        name="accountId"
                        type="hidden"
                        value={account.id}
                      />
                      <label className="text-sm font-medium">
                        Role
                        <select
                          name="role"
                          defaultValue={account.role}
                          className="mt-1 w-56 rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-900"
                        >
                          {roleOptions.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="submit"
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50"
                      >
                        Save
                      </button>
                    </form>
                  )}

                  <form
                    action={changeStatusAction}
                    className="flex flex-wrap items-end gap-3"
                  >
                    <input
                      name="accountId"
                      type="hidden"
                      value={account.id}
                    />
                    <label className="text-sm font-medium">
                      Status
                      <select
                        name="status"
                        defaultValue={account.status}
                        className="mt-1 w-48 rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-900"
                      >
                        <option value="active">Active</option>
                        <option value="deactivated">Deactivated</option>
                      </select>
                    </label>
                    <button
                      type="submit"
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50"
                    >
                      Save
                    </button>
                  </form>
                </div>

                <ResetPasswordForm accountId={account.id} />
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
