import { GraduationCap, Users, BookOpen, Library, Receipt, Wallet, TrendingUp, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItemColor {
  bg: string;
  text: string;
  hoverBorder: string;
}

export interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
  color: NavItemColor;
}

// Literal Tailwind class strings (not interpolated) so the JIT scanner
// picks them up — one hue per destination, fixed order, so a tile keeps
// the same color everywhere it's used (dashboard grid, nav drawer).
const INDIGO: NavItemColor = { bg: "bg-indigo-50", text: "text-indigo-600", hoverBorder: "hover:border-indigo-200" };
const SKY: NavItemColor = { bg: "bg-sky-50", text: "text-sky-600", hoverBorder: "hover:border-sky-200" };
const VIOLET: NavItemColor = { bg: "bg-violet-50", text: "text-violet-600", hoverBorder: "hover:border-violet-200" };
const ORANGE: NavItemColor = { bg: "bg-orange-50", text: "text-orange-600", hoverBorder: "hover:border-orange-200" };
const EMERALD: NavItemColor = { bg: "bg-emerald-50", text: "text-emerald-600", hoverBorder: "hover:border-emerald-200" };
const TEAL: NavItemColor = { bg: "bg-teal-50", text: "text-teal-600", hoverBorder: "hover:border-teal-200" };
const GREEN: NavItemColor = { bg: "bg-green-50", text: "text-green-600", hoverBorder: "hover:border-green-200" };
const ROSE: NavItemColor = { bg: "bg-rose-50", text: "text-rose-600", hoverBorder: "hover:border-rose-200" };

// Shared by the dashboard's tile grid and the nav drawer (available on
// every other page) so both stay in sync from one source.
export const NAV_ITEMS: NavItem[] = [
  { href: "/people/tutors", label: "Tutors", Icon: GraduationCap, color: INDIGO },
  { href: "/people/students", label: "Students", Icon: Users, color: SKY },
  { href: "/subjects", label: "Subjects", Icon: Library, color: VIOLET },
  { href: "/classes", label: "Classes", Icon: BookOpen, color: ORANGE },
  { href: "/fees", label: "Fees", Icon: Receipt, color: EMERALD },
];

export const OWNER_NAV_ITEMS: NavItem[] = [
  { href: "/salaries", label: "Salaries", Icon: Wallet, color: TEAL },
  { href: "/money", label: "Money", Icon: TrendingUp, color: GREEN },
  { href: "/staff/invite", label: "Add staff", Icon: UserPlus, color: ROSE },
];
