import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, Plus, Wallet, BookOpen, ChevronRight, Users, ClipboardCheck } from "lucide-react";
import { getSessionInfo } from "@/lib/auth/session";
import { isOnboardingComplete } from "@/lib/onboarding/queries";
import { getTodaysClasses, type TodayClassRow } from "@/lib/attendance/queries";
import { listClassesForTutor } from "@/lib/classes/queries";
import { getTutorSalary, getTutorIncomeTrend } from "@/lib/salaries/queries";
import { listTutors, listStudents } from "@/lib/people/queries";
import { listFees } from "@/lib/fees/queries";
import { getWalletBalancesForStudents } from "@/lib/wallet/queries";
import { getRevenueShareCommissionPercent } from "@/lib/institute/queries";
import { formatGrade, formatMedium } from "@/lib/classes/labels";
import { logout } from "@/lib/auth/actions";
import { currentMonthInColombo } from "@/lib/time";
import { NAV_ITEMS, OWNER_NAV_ITEMS } from "@/lib/nav-items";
import { Card, EmptyState } from "@/components/card";
import { AdvanceQuickForm } from "./advance-quick-form";
import { RecordFeePaymentForm } from "./record-fee-payment-form";
import { IncomeTrendChart } from "./income-trend-chart";
import { CommissionRateForm } from "./commission-rate-form";

const BUCKET_STYLES: Record<string, { dot: string; button: string; label: string }> = {
  now: { dot: "bg-green-500", button: "bg-indigo-600 text-white hover:bg-indigo-500", label: "Mark attendance" },
  upcoming: { dot: "bg-gray-300", button: "bg-indigo-600 text-white hover:bg-indigo-500", label: "Mark attendance" },
  done: { dot: "bg-gray-200", button: "bg-gray-100 text-gray-600 hover:bg-gray-200", label: "View" },
};

function TodaysClassesList({ classes, showAddLink }: { classes: TodayClassRow[]; showAddLink: boolean }) {
  if (classes.length === 0) {
    return (
      // FR-2.2 — never a blank dashboard, always a next action.
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center">
        <p className="text-sm text-gray-500">Nothing scheduled today.</p>
        {showAddLink && (
          <Link href="/classes" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600">
            <Plus className="h-4 w-4" /> Add a class
          </Link>
        )}
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {classes.map((cls) => {
        const style = BUCKET_STYLES[cls.bucket];
        return (
          <li
            key={cls.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
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
            <Link
              href={`/attendance/${cls.id}`}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm transition ${style.button}`}
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              {style.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

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

  const header = (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-5 sm:px-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">{session.instituteName}</h1>
        <p className="text-sm text-gray-500">
          {session.name} · {session.role === "owner" ? "Owner" : session.role === "admin_staff" ? "Admin Staff" : "Tutor"}
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
  );

  if (session.role === "tutor") {
    const [todaysClasses, myClasses, mySalary, incomeTrend] = await Promise.all([
      getTodaysClasses(session.userId),
      listClassesForTutor(session.userId),
      getTutorSalary(session.userId, currentMonthInColombo()),
      getTutorIncomeTrend(session.userId, 6, currentMonthInColombo()),
    ]);

    return (
      <main className="min-h-full flex-1 bg-gray-50">
        <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-10">
          {header}

          <section className="px-4 sm:px-6">
            <IncomeTrendChart data={incomeTrend.map((d) => ({ month: d.month, value: d.netTotal }))} />
          </section>

          <section className="px-4 sm:px-6">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Today&apos;s classes</h2>
            <TodaysClassesList classes={todaysClasses} showAddLink={false} />
          </section>

          {mySalary && (
            <section className="px-4 sm:px-6">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">My salary</h2>
              <Link href={`/salaries/${session.userId}`}>
                <Card className="flex items-center justify-between gap-4 p-4 transition hover:border-indigo-200 hover:shadow-md">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                      <Wallet className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">LKR {mySalary.netTotal.toFixed(2)}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(`${currentMonthInColombo()}T00:00:00`).toLocaleDateString("en-US", {
                          month: "long",
                          year: "numeric",
                          timeZone: "UTC",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        mySalary.status === "paid" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {mySalary.status === "paid" ? "Paid" : "Unpaid"}
                    </span>
                    <ChevronRight className="h-4 w-4 text-gray-300" />
                  </div>
                </Card>
              </Link>
            </section>
          )}

          <section className="px-4 sm:px-6">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">My classes</h2>
            {myClasses.length === 0 ? (
              <EmptyState icon={BookOpen} message="You're not assigned to any classes yet." />
            ) : (
              <Card className="divide-y divide-gray-100">
                {myClasses.map((cls) => (
                  <Link
                    key={cls.id}
                    href={`/attendance/${cls.id}`}
                    className="flex items-center justify-between gap-4 p-4 transition hover:bg-gray-50"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{cls.subject}</p>
                      <p className="text-sm text-gray-500">
                        {formatGrade(cls.grade)} · {formatMedium(cls.medium)}
                      </p>
                      <p className="text-sm text-gray-400">
                        {cls.scheduleDays.join(", ") || "no schedule set"}
                        {cls.scheduleStartTime ? ` · ${cls.scheduleStartTime}` : ""}
                      </p>
                      <span className="mt-1 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        LKR {cls.collectedThisMonth.toLocaleString()} collected this month
                      </span>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                        <Users className="h-3.5 w-3.5" />
                        {cls.studentCount}
                      </span>
                      {cls.newEnrollmentsThisMonth > 0 && (
                        <span className="text-xs font-medium text-indigo-600">
                          +{cls.newEnrollmentsThisMonth} new
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </Card>
            )}
          </section>
        </div>
      </main>
    );
  }

  const isOwner = session.role === "owner";
  const [todaysClasses, activeTutors, allStudents, allFees, commissionPercent] = await Promise.all([
    getTodaysClasses(),
    isOwner ? listTutors() : Promise.resolve([]),
    listStudents(),
    listFees(),
    isOwner ? getRevenueShareCommissionPercent() : Promise.resolve(null),
  ]);
  const navItems = isOwner ? [...NAV_ITEMS, ...OWNER_NAV_ITEMS] : NAV_ITEMS;
  const tutorOptions = activeTutors.filter((t) => t.status === "active").map((t) => ({ id: t.id, name: t.name }));
  const studentOptions = allStudents.filter((s) => s.status === "active").map((s) => ({ id: s.id, name: s.name }));
  const walletBalances = Object.fromEntries(
    await getWalletBalancesForStudents(studentOptions.map((s) => s.id)),
  );

  return (
    <main className="min-h-full flex-1 bg-gray-50">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-10">
        {header}

        <nav className="grid grid-cols-3 gap-3 px-4 sm:grid-cols-4 sm:px-6">
          {navItems.map(({ href, label, Icon, color }) => (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-2 rounded-xl border border-gray-100 bg-white p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${color.hoverBorder}`}
            >
              <span className={`flex h-12 w-12 items-center justify-center rounded-full ${color.bg} ${color.text}`}>
                <Icon className="h-6 w-6" />
              </span>
              <span className="text-xs font-medium text-gray-700">{label}</span>
            </Link>
          ))}
        </nav>

        <section className="px-4 sm:px-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Today&apos;s classes</h2>
          <TodaysClassesList classes={todaysClasses} showAddLink />
        </section>

        {studentOptions.length > 0 && (
          <section className="px-4 sm:px-6">
            <RecordFeePaymentForm students={studentOptions} fees={allFees} walletBalances={walletBalances} />
          </section>
        )}

        {isOwner && tutorOptions.length > 0 && (
          <section className="px-4 sm:px-6">
            <AdvanceQuickForm tutors={tutorOptions} month={currentMonthInColombo()} />
          </section>
        )}

        {isOwner && commissionPercent !== null && (
          <section className="px-4 sm:px-6">
            <CommissionRateForm currentPercent={commissionPercent} />
          </section>
        )}
      </div>
    </main>
  );
}
