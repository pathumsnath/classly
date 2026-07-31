import type { GradeLevel, ClassMedium } from "@/lib/supabase/types";

export const GRADE_OPTIONS: { value: GradeLevel; label: string }[] = [
  ...Array.from({ length: 13 }, (_, i) => {
    const n = i + 1;
    return { value: `grade_${n}` as GradeLevel, label: `Grade ${n}` };
  }),
  { value: "ol", label: "O/L" },
  { value: "al", label: "A/L" },
];

export const MEDIUM_OPTIONS: { value: ClassMedium; label: string }[] = [
  { value: "sinhala", label: "Sinhala" },
  { value: "english", label: "English" },
  { value: "tamil", label: "Tamil" },
];

export function formatGrade(grade: GradeLevel | null): string {
  return GRADE_OPTIONS.find((g) => g.value === grade)?.label ?? "—";
}

export function formatMedium(medium: ClassMedium | null): string {
  return MEDIUM_OPTIONS.find((m) => m.value === medium)?.label ?? "—";
}
