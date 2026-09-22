import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDonationManagementCapabilities } from "@/lib/donations/server";
import { hasAdminMemberReadAccess } from "@/lib/members/server";
import { signOut } from "../login/actions";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/login");
  }

  const userId = data.claims.sub;
  const [
    canOpenMemberManagement,
    donationCapabilities,
  ] = await Promise.all([
    hasAdminMemberReadAccess(),
    getDonationManagementCapabilities(),
  ]);

  const canOpenDonationManagement =
    donationCapabilities.canVerify ||
    donationCapabilities.canManageObligations ||
    donationCapabilities.canCreateAnonymousDonation ||
    donationCapabilities.canCreateJummahCashDonation;

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-start justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-zinc-500">
              Masjid-e-Mamoor
            </p>
            <h1 className="mt-1 text-3xl font-semibold">
              Application Dashboard
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              Authenticated successfully. Available modules and management
              actions are resolved from your application permissions.
            </p>
          </div>

          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
            >
              Sign out
            </button>
          </form>
        </header>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/profile" className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50">My Profile</Link>
          <Link href="/donations" className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50">Donations</Link>
          {canOpenMemberManagement ? <Link href="/members" className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50">Member Management</Link> : null}
          {canOpenDonationManagement ? <Link href="/donations/manage" className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50">Donation Management</Link> : null}
        </div>

        <div className="mt-8 rounded-2xl border border-black/10 bg-white p-6">
          <h2 className="font-semibold">Authenticated account</h2>
          <p className="mt-2 text-sm text-zinc-600">{userId}</p>
        </div>
      </div>
    </main>
  );
}
