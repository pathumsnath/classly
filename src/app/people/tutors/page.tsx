import { listTutors } from "@/lib/people/queries";
import { setTutorStatus } from "@/lib/people/actions";
import { PageShell } from "@/components/page-shell";
import { AddTutorForm } from "./add-tutor-form";

export default async function TutorsPage() {
  const tutors = await listTutors();

  return (
    <PageShell title="Tutors">
      <ul className="flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200">
        {tutors.length === 0 && <li className="p-4 text-sm text-gray-500">No tutors yet.</li>}
        {tutors.map((tutor) => (
          <li key={tutor.id} className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="font-medium text-gray-900">{tutor.name}</p>
              <p className="text-sm text-gray-500">{tutor.phone}</p>
            </div>
            <form action={setTutorStatus.bind(null, tutor.id, tutor.status === "active" ? "inactive" : "active")}>
              <button
                type="submit"
                className="text-sm font-medium text-indigo-600"
              >
                {tutor.status === "active" ? "Deactivate" : "Reactivate"}
              </button>
            </form>
          </li>
        ))}
      </ul>
      <AddTutorForm />
    </PageShell>
  );
}
