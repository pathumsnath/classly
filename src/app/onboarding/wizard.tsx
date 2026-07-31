"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addTutor, addStudent } from "@/lib/people/actions";
import { createClass } from "@/lib/classes/actions";
import { completeOnboarding } from "@/lib/onboarding/actions";
import { Field, FormError, Select, SubmitButton } from "@/components/form";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function StepActions({ pending, submitLabel, onSkip }: { pending: boolean; submitLabel: string; onSkip: () => void }) {
  return (
    <div className="flex items-center gap-4">
      <SubmitButton disabled={pending}>{submitLabel}</SubmitButton>
      <button type="button" onClick={onSkip} className="text-sm font-medium text-gray-500">
        Skip
      </button>
    </div>
  );
}

function TutorStep({
  onNext,
  onSkip,
}: {
  onNext: (tutor: { id: string; name: string }) => void;
  onSkip: () => void;
}) {
  const [state, formAction, pending] = useActionState(addTutor, {});

  useEffect(() => {
    if (state.success && state.tutorId && state.tutorName) {
      onNext({ id: state.tutorId, name: state.tutorName });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-4">
      <h2 className="text-lg font-semibold text-gray-900">Step 1: Add your first tutor</h2>
      <Field label="Name" name="name" required />
      <Field label="Phone" name="phone" type="tel" required />
      <Field label="Email (optional)" name="email" type="email" />
      <FormError message={state.error} />
      <StepActions pending={pending} submitLabel={pending ? "Adding…" : "Add tutor"} onSkip={onSkip} />
    </form>
  );
}

function ClassStep({
  tutors,
  onNext,
  onSkip,
}: {
  tutors: { id: string; name: string }[];
  onNext: () => void;
  onSkip: () => void;
}) {
  const [state, formAction, pending] = useActionState(createClass, {});

  useEffect(() => {
    if (state.success) onNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (tutors.length === 0) {
    return (
      <div className="flex max-w-sm flex-col gap-4">
        <h2 className="text-lg font-semibold text-gray-900">Step 2: Create your first class</h2>
        <p className="text-sm text-gray-600">
          You skipped adding a tutor, so there&apos;s no one to assign a class to yet — add one from the Tutors
          page later, then come back to Classes.
        </p>
        <button type="button" onClick={onSkip} className="w-fit text-sm font-medium text-gray-500">
          Skip this step
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-4">
      <h2 className="text-lg font-semibold text-gray-900">Step 2: Create your first class</h2>
      <Field label="Subject" name="subject" required />

      <Select label="Tutor" name="tutorId" required defaultValue={tutors[0].id}>
        {tutors.map((tutor) => (
          <option key={tutor.id} value={tutor.id}>
            {tutor.name}
          </option>
        ))}
      </Select>

      <fieldset className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Days
        <div className="flex flex-wrap gap-2">
          {DAYS.map((day) => (
            <label key={day} className="flex items-center gap-1 font-normal text-gray-700">
              <input type="checkbox" name="scheduleDays" value={day} />
              {day}
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Time" name="scheduleTime" type="time" />
      <Field label="Fee amount (LKR)" name="feeAmount" type="number" min={0} step="0.01" required />

      <Select label="Fee type" name="feeType" required defaultValue="monthly_flat">
        <option value="monthly_flat">Monthly flat</option>
        <option value="per_session">Per session</option>
      </Select>

      <Select label="Tutor payment model" name="tutorPaymentModel" required defaultValue="fixed">
        <option value="revenue_share">Revenue share (%)</option>
        <option value="fixed">Fixed salary (LKR)</option>
        <option value="per_student">Per paid student (LKR)</option>
        <option value="per_session">Per session held (LKR)</option>
      </Select>

      <Field label="Tutor payment value" name="tutorPaymentValue" type="number" min={0} step="0.01" required />

      <FormError message={state.error} />
      <StepActions pending={pending} submitLabel={pending ? "Creating…" : "Create class"} onSkip={onSkip} />
    </form>
  );
}

function StudentStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [state, formAction, pending] = useActionState(addStudent, {});

  useEffect(() => {
    if (state.success) onNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-4">
      <h2 className="text-lg font-semibold text-gray-900">Step 3: Add your first student</h2>
      <Field label="Name" name="name" required />
      <Field label="Phone" name="phone" type="tel" required />
      <Field label="Parent phone (optional)" name="parentPhone" type="tel" />
      <FormError message={state.error} />
      <StepActions pending={pending} submitLabel={pending ? "Adding…" : "Add student"} onSkip={onSkip} />
    </form>
  );
}

export function OnboardingWizard({ initialTutors }: { initialTutors: { id: string; name: string }[] }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [tutors, setTutors] = useState(initialTutors);

  async function finish() {
    await completeOnboarding();
    router.push("/");
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-gray-500">Step {step} of 3</p>
      {step === 1 && (
        <TutorStep
          onNext={(tutor) => {
            setTutors((prev) => [...prev, tutor]);
            setStep(2);
          }}
          onSkip={() => setStep(2)}
        />
      )}
      {step === 2 && <ClassStep tutors={tutors} onNext={() => setStep(3)} onSkip={() => setStep(3)} />}
      {step === 3 && <StudentStep onNext={finish} onSkip={finish} />}
    </div>
  );
}
