"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Home, LogOut } from "lucide-react";
import { NAV_ITEMS, OWNER_NAV_ITEMS } from "@/lib/nav-items";
import { logout } from "@/lib/auth/actions";
import type { AppRole } from "@/lib/supabase/types";

export function NavDrawer({
  role,
  instituteName,
  userName,
}: {
  role: AppRole;
  instituteName: string;
  userName: string;
}) {
  const [open, setOpen] = useState(false);
  const items = role === "owner" ? [...NAV_ITEMS, ...OWNER_NAV_ITEMS] : role === "admin_staff" ? NAV_ITEMS : [];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-50 hover:text-gray-700"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Slide-in panel */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80vw] flex-col bg-white shadow-xl transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-5">
          <div>
            <p className="font-bold text-gray-900">{instituteName}</p>
            <p className="text-sm text-gray-500">
              {userName} · {role === "owner" ? "Owner" : role === "admin_staff" ? "Admin Staff" : "Tutor"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-50 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            <Home className="h-4 w-4 text-gray-400" />
            Dashboard
          </Link>
          {items.map(({ href, label, Icon, color }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${color.bg} ${color.text}`}>
                <Icon className="h-4 w-4" />
              </span>
              {label}
            </Link>
          ))}
        </nav>

        <form action={logout} className="border-t border-gray-100 p-3">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </form>
      </div>
    </>
  );
}
