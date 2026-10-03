import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getFinanceAccountCapabilities,
  getFinanceAccounts,
} from "@/lib/finance/server";

import {
  createFinanceAccountAction,
  setFinanceAccountStatusAction,
} from "./actions";
import { FinanceStatusSubmitButton } from "./FinanceStatusSubmitButton";

type PageProps = {
  searchParams: Promise<{
    error?: string;
    created?: string;
    updated?: string;
  }>;
};

export default async function FinanceAccountsPage({
  searchParams,
}: PageProps) {
  const [params, capabilities] = await Promise.all([
    searchParams,
    getFinanceAccountCapabilities(),
  ]);

  if (!capabilities.canReadAccounts) {
    redirect("/dashboard");
  }

  const accounts = await getFinanceAccounts();

  const totalBalancePaise = accounts.reduce(
    (sum, account) => sum + account.balancePaise,
    0,
  );

  const summary = {
    total: accounts.length,
    active: accounts.filter(
      (account) => account.status === "active",
    ).length,
    inactive: accounts.filter(
      (account) => account.status === "inactive",
    ).length,
    closed: accounts.filter(
      (account) => account.status === "closed",
    ).length,
  };

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-emerald-950/10 pb-8">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-emerald-800 hover:text-emerald-950"
          >
            ← Dashboard
          </Link>

          <p className="eyebrow mt-6">
            Finance
          </p>

          <h1 className="page-title">
            Finance accounts
          </h1>

          <p className="page-intro">
            Manage the organization&apos;s Bank, UPI,
            Cash, and Other Finance accounts. Balances
            are derived from the immutable financial
            ledger.
          </p>
        </header>

        {params.error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {errorMessage(params.error)}
          </div>
        ) : null}

        {params.created ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            Finance account created.
          </div>
        ) : null}

        {params.updated ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            Finance account status updated.
          </div>
        ) : null}

        <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Metric
            label="Total balance"
            value={formatMoney(totalBalancePaise)}
          />
          <Metric
            label="Accounts"
            value={String(summary.total)}
          />
          <Metric
            label="Active"
            value={String(summary.active)}
            tone="good"
          />
          <Metric
            label="Inactive"
            value={String(summary.inactive)}
            tone={summary.inactive ? "warn" : undefined}
          />
          <Metric
            label="Closed"
            value={String(summary.closed)}
          />
        </section>

        {capabilities.canManageAccounts ? (
          <section className="surface mt-8 p-6 sm:p-8">
            <p className="eyebrow">
              Administration
            </p>

            <h2 className="section-title">
              Create Finance account
            </h2>

            <p className="mt-2 text-sm text-zinc-600">
              Create the real receiving account before
              using it for verified donations or future
              Finance operations.
            </p>

            <form
              action={createFinanceAccountAction}
              className="mt-5 grid gap-4 lg:grid-cols-[1fr_240px_auto] lg:items-end"
            >
              <label className="field-label">
                Account name
                <input
                  name="name"
                  required
                  maxLength={120}
                  placeholder="Example: Main UPI"
                  className="field-input"
                />
              </label>

              <label className="field-label">
                Account type
                <select
                  name="accountType"
                  required
                  defaultValue="upi"
                  className="field-input"
                >
                  <option value="bank">
                    Bank
                  </option>
                  <option value="upi">
                    UPI
                  </option>
                  <option value="cash">
                    Cash
                  </option>
                  <option value="other">
                    Other
                  </option>
                </select>
              </label>

              <button
                type="submit"
                className="button-primary"
              >
                Create account
              </button>
            </form>
          </section>
        ) : (
          <section className="surface mt-8 p-6 text-sm text-zinc-600">
            You have read-only Finance account access.
          </section>
        )}

        <section className="mt-8">
          <p className="eyebrow">
            Accounts
          </p>

          <h2 className="section-title">
            Finance account directory
          </h2>

          <p className="mt-2 text-sm text-zinc-600">
            Closed accounts remain visible for historical
            reporting and cannot be reopened.
          </p>

          <div className="mt-5 grid gap-4">
            {accounts.map((account) => (
              <article
                key={account.id}
                className="surface overflow-hidden"
              >
                <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-emerald-950">
                        {account.name}
                      </h3>

                      <span className="status-badge">
                        {accountTypeLabel(
                          account.accountType,
                        )}
                      </span>

                      <span
                        className={`status-badge ${
                          account.status === "active"
                            ? "status-active"
                            : account.status === "inactive"
                              ? "status-warning"
                              : ""
                        }`}
                      >
                        {statusLabel(account.status)}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-zinc-500">
                      {account.currency} · Created{" "}
                      {formatDate(account.createdAt)}
                    </p>
                  </div>

                  <div className="lg:text-right">
                    <p className="text-sm text-zinc-500">
                      Ledger balance
                    </p>

                    <p className="mt-1 text-2xl font-semibold text-emerald-950">
                      {formatMoney(account.balancePaise)}
                    </p>
                  </div>
                </div>

                {capabilities.canManageAccounts &&
                account.status !== "closed" ? (
                  <div className="border-t border-zinc-100 bg-zinc-50/70 p-5 sm:p-6">
                    <div className="flex flex-wrap gap-3">
                      {account.status === "active" ? (
                        <form
                          action={
                            setFinanceAccountStatusAction
                          }
                        >
                          <input
                            type="hidden"
                            name="financeAccountId"
                            value={account.id}
                          />

                          <input
                            type="hidden"
                            name="status"
                            value="inactive"
                          />

                          <FinanceStatusSubmitButton className="button-secondary">
                            Mark inactive
                          </FinanceStatusSubmitButton>
                        </form>
                      ) : (
                        <form
                          action={
                            setFinanceAccountStatusAction
                          }
                        >
                          <input
                            type="hidden"
                            name="financeAccountId"
                            value={account.id}
                          />

                          <input
                            type="hidden"
                            name="status"
                            value="active"
                          />

                          <FinanceStatusSubmitButton className="button-secondary">
                            Reactivate
                          </FinanceStatusSubmitButton>
                        </form>
                      )}

                      <form
                        action={
                          setFinanceAccountStatusAction
                        }
                      >
                        <input
                          type="hidden"
                          name="financeAccountId"
                          value={account.id}
                        />

                        <input
                          type="hidden"
                          name="status"
                          value="closed"
                        />

                        <FinanceStatusSubmitButton
                          className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-800"
                          confirmMessage={`Close ${account.name} permanently? Closed Finance accounts cannot be reopened.`}
                        >
                          Close permanently
                        </FinanceStatusSubmitButton>
                      </form>
                    </div>
                  </div>
                ) : null}

                {account.status === "closed" ? (
                  <div className="border-t border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm text-zinc-600 sm:px-6">
                    This account is permanently closed.
                    Historical ledger records remain
                    available.
                  </div>
                ) : null}
              </article>
            ))}

            {accounts.length === 0 ? (
              <div className="surface p-8 text-center text-sm text-zinc-500">
                No Finance accounts have been created
                yet.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn";
}) {
  return (
    <div className="surface p-5">
      <p className="text-sm text-zinc-500">
        {label}
      </p>

      <p
        className={`mt-2 text-2xl font-semibold ${
          tone === "warn"
            ? "text-amber-700"
            : tone === "good"
              ? "text-emerald-800"
              : "text-emerald-950"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function formatMoney(amountPaise: number) {
  const sign = amountPaise < 0 ? "-" : "";
  const absolute = Math.abs(amountPaise);
  const rupees = Math.floor(absolute / 100);
  const paise = absolute % 100;

  return `${sign}₹${rupees.toLocaleString("en-IN")}.${String(
    paise,
  ).padStart(2, "0")}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function accountTypeLabel(value: string) {
  return {
    bank: "Bank",
    upi: "UPI",
    cash: "Cash",
    other: "Other",
  }[value] ?? value;
}

function statusLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (letter) => letter.toUpperCase(),
    );
}

function errorMessage(error: string) {
  return {
    invalid_account:
      "Enter a valid Finance account name and type.",
    create_failed:
      "The Finance account could not be created.",
    invalid_status:
      "The requested Finance account status is invalid.",
    status_failed:
      "The Finance account status could not be changed.",
  }[error] ?? "The Finance action could not be completed.";
}
