import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/auth/session";
import { isOnboardingComplete } from "@/lib/onboarding/queries";
import { getTodaysClasses } from "@/lib/attendance/queries";
import { logout } from "@/lib/auth/actions";

const BUCKET_STYLES: Record<string, string> = {
  now: "bg-green-100 text-green-700",
  upcoming: "bg-gray-100 text-gray-600",
  done: "bg-gray-100 text-gray-400",
};

export default async function DashboardPage() {
  const session = await getSessionInfo();

  if (!session) {
    return (
      <main className="flex flex-1 items-center justify-center bg-white p-6">
        <p className="text-gray-600">Not signed in.</p>
      </main>
    );
  }

  if (!(await isOnboardingComplete())) {
    redirect("/onboarding");
  }

  const todaysClasses = await getTodaysClasses();

  return (
    <main className="flex flex-1 flex-col gap-6 bg-white p-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{session.instituteName}</h1>
        <p className="text-sm text-gray-500">
          {session.name} · {session.role === "owner" ? "Owner" : "Admin Staff"}
        </p>
      </div>

      <nav className="flex flex-wrap gap-4 text-sm font-medium text-indigo-600">
        <Link href="/people/tutors">Tutors</Link>
        <Link href="/people/students">Students</Link>
        <Link href="/classes">Classes</Link>
        <Link href="/fees">Fees</Link>
        {session.role === "owner" && (
          <>
            <Link href="/salaries">Salaries</Link>
            <Link href="/money">Money</Link>
            <Link href="/staff/invite">Add admin staff</Link>
          </>
        )}
      </nav>

      <div>
        <h2 className="mb-2 font-semibold text-gray-900">Today&apos;s classes</h2>
        {todaysClasses.length === 0 ? (
          // FR-2.2 — never a blank dashboard, always a next action.
          <div className="max-w-sm rounded-lg border border-gray-200 p-4 text-sm text-gray-600">
            Nothing scheduled today.{" "}
            <Link href="/classes" className="font-medium text-indigo-600">
              Add a class
            </Link>{" "}
            to get started.
          </div>
        ) : (
          <ul className="flex max-w-sm flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
            {todaysClasses.map((cls) => (
              <li key={cls.id} className="flex items-center justify-between gap-4 p-4">
                <Link href={`/attendance/${cls.id}`} className="font-medium text-indigo-600">
                  {cls.subject}
                </Link>
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${BUCKET_STYLES[cls.bucket]}`}>
                  {cls.scheduleTime ?? ""} {cls.bucket}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form action={logout}>
        <button type="submit" className="w-fit text-sm font-medium text-red-600">
          Log out
        </button>
      </form>
    </main>
  );
}
