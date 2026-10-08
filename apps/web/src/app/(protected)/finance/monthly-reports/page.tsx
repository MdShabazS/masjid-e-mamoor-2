import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getFinanceMonthlyReportCapabilities,
  getFinanceMonthlyReports,
  type FinanceMonthlyReport,
} from "@/lib/finance/server";
import {
  previousCompletedFinanceMonthInput,
} from "@/lib/finance/monthly";

import {
  generateFinanceMonthlyReportAction,
} from "./actions";

type PageProps = {
  searchParams: Promise<{
    error?: string;
    generated?: string;
    busy?: string;
  }>;
};

export default async function FinanceMonthlyReportsPage({
  searchParams,
}: PageProps) {
  const [params, capabilities] = await Promise.all([
    searchParams,
    getFinanceMonthlyReportCapabilities(),
  ]);

  if (!capabilities.canRead) {
    redirect("/dashboard");
  }

  const reports = await getFinanceMonthlyReports();

  const latestReady =
    reports.find(
      (report) => report.status === "ready",
    ) ?? null;

  const latestReport = reports[0] ?? null;
  const latestMonth =
    latestReady?.reportMonth ??
    latestReport?.reportMonth ??
    null;

  const latestRevision = latestMonth
    ? Math.max(
        ...reports
          .filter(
            (report) =>
              report.reportMonth === latestMonth,
          )
          .map((report) => report.revision),
      )
    : null;

  const previousMonth =
    previousCompletedFinanceMonthInput();

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
            Monthly Finance Reports
          </h1>

          <p className="page-intro">
            Monthly reports are immutable accounting
            snapshots rendered into downloadable PDF
            revisions from the authoritative Finance
            ledger.
          </p>
        </header>

        {params.generated ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            Monthly Finance report generated successfully.
          </div>
        ) : null}

        {params.busy ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Report rendering is already in progress.
          </div>
        ) : null}

        {params.error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {errorMessage(params.error)}
          </div>
        ) : null}

        <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Latest report month"
            value={
              latestMonth
                ? formatReportMonth(latestMonth)
                : "—"
            }
          />

          <Metric
            label="Latest closing balance"
            value={
              latestReady
                ? formatMoney(
                    latestReady.closingBalancePaise,
                  )
                : "—"
            }
          />

          <Metric
            label="Reports available"
            value={String(
              reports.filter(
                (report) =>
                  report.status === "ready",
              ).length,
            )}
          />

          <Metric
            label="Latest revision"
            value={
              latestRevision
                ? `v${latestRevision}`
                : "—"
            }
          />
        </section>

        {capabilities.canManage ? (
          <section className="surface mt-8 p-6 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="eyebrow">
                  Administration
                </p>

                <h2 className="section-title">
                  Generate report
                </h2>

                <p className="mt-2 max-w-2xl text-sm text-zinc-600">
                  Generate or regenerate a completed
                  month. If historical Finance data has
                  changed, the system preserves the old
                  report and creates a new immutable
                  revision.
                </p>
              </div>

              <form
                action={
                  generateFinanceMonthlyReportAction
                }
                className="grid gap-3 sm:grid-cols-[220px_auto] sm:items-end"
              >
                <label className="field-label">
                  Report month
                  <input
                    type="month"
                    name="reportMonth"
                    required
                    max={previousMonth}
                    defaultValue={previousMonth}
                    className="field-input"
                  />
                </label>

                <button
                  type="submit"
                  className="button-primary"
                >
                  Generate report
                </button>
              </form>
            </div>
          </section>
        ) : null}

        {latestReady ? (
          <section className="mt-10">
            <div>
              <p className="eyebrow">
                Latest available report
              </p>

              <h2 className="section-title">
                {formatReportMonth(
                  latestReady.reportMonth,
                )}
              </h2>
            </div>

            <article className="surface mt-5 overflow-hidden">
              <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="status-badge status-active">
                      Ready
                    </span>

                    <span className="status-badge">
                      Revision v
                      {latestReady.revision}
                    </span>

                    <span className="status-badge">
                      {sourceLabel(
                        latestReady.generationSource,
                      )}
                    </span>
                  </div>

                  <p className="mt-4 text-sm text-zinc-600">
                    Ledger-based immutable Finance
                    snapshot. Previous revisions remain
                    preserved when historical Finance
                    data changes.
                  </p>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Detail
                      label="Closing balance"
                      value={formatMoney(
                        latestReady.closingBalancePaise,
                      )}
                    />

                    <Detail
                      label="Donation inflow"
                      value={formatMoney(
                        latestReady.donationInflowPaise,
                      )}
                    />

                    <Detail
                      label="Expenditure"
                      value={formatMoney(
                        latestReady.expenseOutflowPaise,
                      )}
                    />

                    <Detail
                      label="Transactions"
                      value={String(
                        latestReady.transactionCount,
                      )}
                    />
                  </div>

                  <div className="mt-6 grid gap-3 text-sm text-zinc-600 sm:grid-cols-2">
                    <p>
                      <span className="font-medium text-zinc-800">
                        Generated:
                      </span>{" "}
                      {latestReady.generatedAt
                        ? formatDateTime(
                            latestReady.generatedAt,
                          )
                        : "—"}
                    </p>

                    <p>
                      <span className="font-medium text-zinc-800">
                        File size:
                      </span>{" "}
                      {formatFileSize(
                        latestReady.fileSizeBytes,
                      )}
                    </p>

                    <p className="sm:col-span-2">
                      <span className="font-medium text-zinc-800">
                        SHA-256:
                      </span>{" "}
                      <span className="font-mono text-xs">
                        {shortHash(
                          latestReady.fileSha256,
                        )}
                      </span>
                    </p>
                  </div>
                </div>

                <Link
                  href={`/finance/monthly-reports/${latestReady.id}/download`}
                  className="button-primary whitespace-nowrap"
                  aria-label={`Download ${formatReportMonth(latestReady.reportMonth)} revision ${latestReady.revision} PDF`}
                >
                  Download PDF
                </Link>
              </div>
            </article>
          </section>
        ) : (
          <section className="surface mt-10 p-8 text-center">
            <p className="text-sm font-medium text-emerald-950">
              Monthly Finance reports will appear here
              after generation.
            </p>

            <p className="mt-2 text-sm text-zinc-500">
              Completed months can be generated by an
              authorized Finance manager.
            </p>
          </section>
        )}

        <section className="mt-10">
          <p className="eyebrow">
            Report archive
          </p>

          <h2 className="section-title">
            Report history
          </h2>

          <p className="mt-2 max-w-3xl text-sm text-zinc-600">
            A new revision is created when historical
            Finance data changes. Previous revisions
            remain preserved.
          </p>

          {reports.length ? (
            <>
              <div className="surface mt-5 hidden overflow-hidden md:block">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                    <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-5 py-4 font-semibold">
                          Month
                        </th>
                        <th className="px-5 py-4 font-semibold">
                          Revision
                        </th>
                        <th className="px-5 py-4 font-semibold">
                          Status
                        </th>
                        <th className="px-5 py-4 font-semibold">
                          Source
                        </th>
                        <th className="px-5 py-4 font-semibold">
                          Closing balance
                        </th>
                        <th className="px-5 py-4 font-semibold">
                          Transactions
                        </th>
                        <th className="px-5 py-4 font-semibold">
                          Generated
                        </th>
                        <th className="px-5 py-4 font-semibold">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-zinc-100">
                      {reports.map((report) => (
                        <ReportRow
                          key={report.id}
                          report={report}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:hidden">
                {reports.map((report) => (
                  <ReportCard
                    key={report.id}
                    report={report}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="surface mt-5 p-8 text-center text-sm text-zinc-500">
              No monthly Finance reports are available
              yet.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="surface p-5">
      <p className="text-sm text-zinc-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold text-emerald-950">
        {value}
      </p>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/70 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>

      <p className="mt-1 text-lg font-semibold text-emerald-950">
        {value}
      </p>
    </div>
  );
}

function ReportRow({
  report,
}: {
  report: FinanceMonthlyReport;
}) {
  return (
    <tr>
      <td className="px-5 py-4 font-medium text-zinc-950">
        {formatReportMonth(report.reportMonth)}
      </td>

      <td className="px-5 py-4 text-zinc-600">
        v{report.revision}
      </td>

      <td className="px-5 py-4">
        <StatusBadge status={report.status} />
      </td>

      <td className="px-5 py-4 text-zinc-600">
        {sourceLabel(report.generationSource)}
      </td>

      <td className="px-5 py-4 font-medium text-zinc-900">
        {formatMoney(report.closingBalancePaise)}
      </td>

      <td className="px-5 py-4 text-zinc-600">
        {report.transactionCount}
      </td>

      <td className="px-5 py-4 text-zinc-600">
        {report.generatedAt
          ? formatDateTime(report.generatedAt)
          : "—"}
      </td>

      <td className="px-5 py-4">
        <ReportAction report={report} />
      </td>
    </tr>
  );
}

function ReportCard({
  report,
}: {
  report: FinanceMonthlyReport;
}) {
  return (
    <article className="surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-emerald-950">
            {formatReportMonth(report.reportMonth)}
          </p>

          <p className="mt-1 text-sm text-zinc-500">
            Revision v{report.revision} ·{" "}
            {sourceLabel(report.generationSource)}
          </p>
        </div>

        <StatusBadge status={report.status} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-zinc-500">
            Closing balance
          </p>
          <p className="mt-1 font-semibold text-zinc-900">
            {formatMoney(
              report.closingBalancePaise,
            )}
          </p>
        </div>

        <div>
          <p className="text-zinc-500">
            Transactions
          </p>
          <p className="mt-1 font-semibold text-zinc-900">
            {report.transactionCount}
          </p>
        </div>

        <div className="col-span-2">
          <p className="text-zinc-500">
            Generated
          </p>
          <p className="mt-1 text-zinc-700">
            {report.generatedAt
              ? formatDateTime(report.generatedAt)
              : "—"}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <ReportAction report={report} />
      </div>
    </article>
  );
}

function StatusBadge({
  status,
}: {
  status: FinanceMonthlyReport["status"];
}) {
  const className =
    status === "ready"
      ? "status-badge status-active"
      : status === "generating"
        ? "status-badge status-warning"
        : "status-badge border-red-200 bg-red-50 text-red-700";

  return (
    <span className={className}>
      {status === "ready"
        ? "Ready"
        : status === "generating"
          ? "Rendering"
          : "Failed"}
    </span>
  );
}

function ReportAction({
  report,
}: {
  report: FinanceMonthlyReport;
}) {
  if (report.status === "ready") {
    return (
      <Link
        href={`/finance/monthly-reports/${report.id}/download`}
        className="text-sm font-semibold text-emerald-800 hover:text-emerald-950"
        aria-label={`Download ${formatReportMonth(report.reportMonth)} revision ${report.revision} PDF`}
      >
        Download PDF
      </Link>
    );
  }

  if (report.status === "generating") {
    return (
      <span className="text-sm text-amber-700">
        Rendering…
      </span>
    );
  }

  return (
    <span className="text-sm text-red-700">
      Generation failed
    </span>
  );
}

function formatMoney(amountPaise: number) {
  const sign = amountPaise < 0 ? "-" : "";
  const absolute = Math.abs(amountPaise);
  const rupees = Math.floor(absolute / 100);
  const paise = absolute % 100;

  return `${sign}₹${rupees.toLocaleString(
    "en-IN",
  )}.${String(paise).padStart(2, "0")}`;
}

function formatReportMonth(value: string) {
  return new Date(
    `${value}T00:00:00.000Z`,
  ).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function formatFileSize(
  value: number | null,
) {
  if (!value || value <= 0) {
    return "—";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(
    value /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

function shortHash(
  value: string | null,
) {
  if (!value) {
    return "—";
  }

  if (value.length <= 20) {
    return value;
  }

  return `${value.slice(0, 12)}…${value.slice(-8)}`;
}

function sourceLabel(
  source: FinanceMonthlyReport["generationSource"],
) {
  return source === "scheduled"
    ? "Scheduled"
    : "Manual";
}

function errorMessage(error: string) {
  return {
    invalid_month:
      "Select a valid completed calendar month.",
    not_authorized:
      "You are not authorized to generate monthly Finance reports.",
    generation_failed:
      "The monthly Finance report could not be generated. Please try again.",
  }[error] ??
    "The monthly Finance report action could not be completed.";
}
