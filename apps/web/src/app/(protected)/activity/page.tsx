import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/accounts/server";
import { listMemberActivity } from "@/lib/activity/server";
import { resolveActivityPeriod } from "@/lib/activity/filters";

type Props = { searchParams: Promise<{ period?: string; month?: string; year?: string; from?: string; to?: string }> };
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

export default async function ActivityPage({ searchParams }: Props) {
  const account = await getCurrentAccount();
  if (!account || account.status !== "active") redirect("/login");
  const params = await searchParams;
  let period;
  try { period = resolveActivityPeriod(params); }
  catch { period = resolveActivityPeriod({}); }
  const people = await listMemberActivity(period.startDate, period.endDate);
  return <main className="min-h-screen px-5 py-8 sm:px-8"><div className="mx-auto max-w-6xl">
    <header className="border-b border-emerald-950/10 pb-7">
      <Link href="/dashboard" className="text-sm font-medium text-emerald-800">← Dashboard</Link>
      <p className="eyebrow mt-6">Masjid E Mamoor 2</p>
      <h1 className="page-title">Member activity</h1>
      <p className="page-intro">Task, meeting, and verified referral contributions for {period.label}. Accounts remain visible after deactivation so past work stays recorded.</p>
    </header>
    <form method="get" className="surface mt-7 grid gap-4 p-5 sm:grid-cols-3 lg:grid-cols-6">
      <label className="field-label">Period<select className="field-input" name="period" defaultValue={params.period === "year" || params.period === "custom" ? params.period : "month"}><option value="month">Month</option><option value="year">Calendar year</option><option value="custom">Custom dates</option></select></label>
      <label className="field-label">Month<input className="field-input" type="month" name="month" defaultValue={params.month ?? period.startDate.slice(0, 7)} /></label>
      <label className="field-label">Year<input className="field-input" type="number" min="2000" max="2100" name="year" defaultValue={params.year ?? period.startDate.slice(0, 4)} /></label>
      <label className="field-label">From<input className="field-input" type="date" name="from" defaultValue={params.from ?? period.startDate} /></label>
      <label className="field-label">To<input className="field-input" type="date" name="to" defaultValue={params.to ?? period.endDate} /></label>
      <button className="button-primary self-end">Apply dates</button>
    </form>
    <p className="mt-5 text-sm text-zinc-600">Assigned tasks are counted on assignment day; completed tasks on completion day. Meetings use the scheduled India date. An unanswered invitation becomes absent after that date. Verified referred donations are credited through a completed member referral, never to the person who entered the payment.</p>
    <section className="mt-6 grid gap-4 lg:grid-cols-2" aria-label="Member activity details">
      {people.map((person) => <article key={person.id} className="surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-lg font-semibold text-emerald-950">{person.displayName}</h2><p className="text-sm text-zinc-600">{person.roleName}</p></div></div>
        <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div><dt className="text-zinc-500">Tasks assigned</dt><dd className="text-lg font-semibold">{person.taskAssigned}</dd></div>
          <div><dt className="text-zinc-500">Tasks completed</dt><dd className="text-lg font-semibold">{person.taskCompleted}</dd></div>
          <div><dt className="text-zinc-500">Meetings invited</dt><dd className="text-lg font-semibold">{person.meetingInvited}</dd></div>
          <div><dt className="text-zinc-500">Attended</dt><dd className="text-lg font-semibold">{person.meetingAttended}</dd></div>
          <div><dt className="text-zinc-500">Declined</dt><dd className="text-lg font-semibold">{person.meetingDeclined}</dd></div>
          <div><dt className="text-zinc-500">Absent</dt><dd className="text-lg font-semibold">{person.meetingAbsent}</dd></div>
          <div><dt className="text-zinc-500">Verified referred donations</dt><dd className="text-lg font-semibold">{person.verifiedReferredDonationCount}</dd></div>
          <div className="col-span-2"><dt className="text-zinc-500">Verified referred amount</dt><dd className="text-lg font-semibold">{inr.format(person.verifiedReferredDonationPaise / 100)}</dd></div>
        </dl>
      </article>)}
      {people.length === 0 && <p className="surface p-8 text-sm text-zinc-600">No accounts are available.</p>}
    </section>
  </div></main>;
}
