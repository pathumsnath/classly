import { GraduationCap, Users, BookOpen, Library, Receipt, Wallet, TrendingUp, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
}

// Shared by the dashboard's tile grid and the nav drawer (available on
// every other page) so both stay in sync from one source.
export const NAV_ITEMS: NavItem[] = [
  { href: "/people/tutors", label: "Tutors", Icon: GraduationCap },
  { href: "/people/students", label: "Students", Icon: Users },
  { href: "/subjects", label: "Subjects", Icon: Library },
  { href: "/classes", label: "Classes", Icon: BookOpen },
  { href: "/fees", label: "Fees", Icon: Receipt },
];

export const OWNER_NAV_ITEMS: NavItem[] = [
  { href: "/salaries", label: "Salaries", Icon: Wallet },
  { href: "/money", label: "Money", Icon: TrendingUp },
  { href: "/staff/invite", label: "Add staff", Icon: UserPlus },
];
