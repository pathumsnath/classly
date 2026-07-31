import Link from "next/link";
import { redirect } from "next/navigation";
import {
  GraduationCap,
  Users,
  BookOpen,
  Receipt,
  Wallet,
  TrendingUp,
  UserPlus,
  LogOut,
  Plus,
} from "lucide-react";
import { getSessionInfo } from "@/lib/auth/session";
import { isOnboardingComplete } from "@/lib/onboarding/queries";
import { getTodaysClasses } from "@/lib/attendance/queries";
import { logout } from "@/lib/auth/actions";

const BUCKET_STYLES: Record<string, { dot: string; pill: string }> = {
  now: { dot: "bg-green-500", pill: "bg-green-50 text-green-700" },
  upcoming: { dot: "bg-gray-300", pill: "bg-gray-100 text-gray-600" },
  done: { dot: "bg-gray-200", pill: "bg-gray-50 text-gray-400" },
};

const NAV_ITEMS = [
  { href: "/people/tutors", label: "Tutors", Icon: GraduationCap },
  { href: "/people/students", label: "Students", Icon: Users },
  { href: "/classes", label: "Classes", Icon: BookOpen },
  { href: "/fees", label: "Fees", Icon: Receipt },
] as const;

const OWNER_NAV_ITEMS = [
  { href: "/salaries", label: "Salaries", Icon: Wallet },
  { href: "/money", label: "Money", Icon: TrendingUp },
  { href: "/staff/invite", label: "Add staff", Icon: UserPlus },
] as const;

export default async function DashboardPage() {
  const session = await getSessionInfo();

  if (!session) {
    return (
      <main className="flex flex-1 items-center justify-center bg-gray-50 p-6">
        <p className="text-gray-600">Not signed in.</p>
      </main>
    );
  }

  if (!(await isOnboardingComplete())) {
    redirect("/onboarding");
  }

  const todaysClasses = await getTodaysClasses();
  const navItems = session.role === "owner" ? [...NAV_ITEMS, ...OWNER_NAV_ITEMS] : NAV_ITEMS;

  return (
    <main className="min-h-full flex-1 bg-gray-50">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-10">
        <header className="flex items-center justify-between border-b border-gray-100 bg-white px-4 py-5 sm:px-6">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{session.instituteName}</h1>
            <p className="text-sm text-gray-500">
              {session.name} · {session.role === "owner" ? "Owner" : "Admin Staff"}
            </p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              aria-label="Log out"
              className="rounded-full p-2 text-gray-400 transition hover:bg-gray-50 hover:text-red-600"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </form>
        </header>

        <nav className="grid grid-cols-3 gap-3 px-4 sm:grid-cols-4 sm:px-6">
          {navItems.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-2 rounded-xl border border-gray-100 bg-white p-4 text-center shadow-sm transition hover:border-indigo-200 hover:shadow-md"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-xs font-medium text-gray-700">{label}</span>
            </Link>
          ))}
        </nav>

        <section className="px-4 sm:px-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Today&apos;s classes</h2>

          {todaysClasses.length === 0 ? (
            // FR-2.2 — never a blank dashboard, always a next action.
            <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center">
              <p className="text-sm text-gray-500">Nothing scheduled today.</p>
              <Link
                href="/classes"
                className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600"
              >
                <Plus className="h-4 w-4" /> Add a class
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {todaysClasses.map((cls) => {
                const style = BUCKET_STYLES[cls.bucket];
                return (
                  <li key={cls.id}>
                    <Link
                      href={`/attendance/${cls.id}`}
                      className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} />
                        <div>
                          <p className="font-medium text-gray-900">{cls.subject}</p>
                          {cls.scheduleStartTime && (
                            <p className="text-xs text-gray-500">
                              {cls.scheduleStartTime}
                              {cls.scheduleEndTime ? `–${cls.scheduleEndTime}` : ""}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${style.pill}`}>
                        {cls.bucket}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
