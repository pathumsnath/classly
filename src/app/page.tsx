import Link from "next/link";
import { getSessionInfo } from "@/lib/auth/session";
import { logout } from "@/lib/auth/actions";

// Bare Phase A dashboard: proves the auth + role + tenant pipeline works
// end to end. The real onboarding wizard/dashboard (FR-2.1/2.2) is Phase B.
export default async function DashboardPage() {
  const session = await getSessionInfo();

  if (!session) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <p className="text-gray-600">Not signed in.</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-6">
      <h1 className="text-xl font-bold text-gray-900">{session.instituteName}</h1>
      <p className="text-gray-700">
        Signed in as <span className="font-medium">{session.name}</span> (
        {session.role === "owner" ? "Owner" : "Admin Staff"})
      </p>
      <p className="text-sm text-gray-500">{session.phone}</p>

      <nav className="flex flex-col gap-2">
        <Link href="/people/tutors" className="text-sm font-medium text-indigo-600">
          Tutors
        </Link>
        <Link href="/people/students" className="text-sm font-medium text-indigo-600">
          Students
        </Link>
        <Link href="/classes" className="text-sm font-medium text-indigo-600">
          Classes
        </Link>
        <Link href="/fees" className="text-sm font-medium text-indigo-600">
          Fees
        </Link>
        {session.role === "owner" && (
          <Link href="/staff/invite" className="text-sm font-medium text-indigo-600">
            Add admin staff
          </Link>
        )}
      </nav>

      <form action={logout}>
        <button type="submit" className="w-fit text-sm font-medium text-red-600">
          Log out
        </button>
      </form>
    </main>
  );
}
