import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function PageShell({
  title,
  backHref = "/",
  children,
}: {
  title: string;
  backHref?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-full flex-1 bg-gray-50">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-10">
        <header className="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-5 sm:px-6">
          <Link
            href={backHref}
            aria-label="Back"
            className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-50 hover:text-gray-700"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold text-gray-900">{title}</h1>
        </header>
        <div className="flex flex-col gap-6 px-4 sm:px-6">{children}</div>
      </div>
    </main>
  );
}
