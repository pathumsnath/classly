export interface SubjectColor {
  bg: string;
  text: string;
  dot: string;
  border: string;
}

// Literal Tailwind class strings (not interpolated) so the JIT scanner
// picks them up — see nav-items.ts for the same constraint. One hue per
// subject name (hashed, stable across renders) so "ICT" always reads as
// the same color everywhere it appears, without hand-assigning one.
const PALETTE: SubjectColor[] = [
  { bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-500", border: "border-indigo-400" },
  { bg: "bg-violet-50", text: "text-violet-700", dot: "bg-violet-500", border: "border-violet-400" },
  { bg: "bg-sky-50", text: "text-sky-700", dot: "bg-sky-500", border: "border-sky-400" },
  { bg: "bg-teal-50", text: "text-teal-700", dot: "bg-teal-500", border: "border-teal-400" },
  { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", border: "border-emerald-400" },
  { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", border: "border-amber-400" },
  { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500", border: "border-rose-400" },
  { bg: "bg-fuchsia-50", text: "text-fuchsia-700", dot: "bg-fuchsia-500", border: "border-fuchsia-400" },
];

export function subjectColor(subject: string): SubjectColor {
  let hash = 0;
  for (let i = 0; i < subject.length; i++) hash = (hash * 31 + subject.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}
