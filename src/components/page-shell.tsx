import Link from "next/link";

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
    <main className="flex flex-1 flex-col gap-4 bg-white p-6">
      <Link href={backHref} className="text-sm font-medium text-indigo-600">
        &larr; Back
      </Link>
      <h1 className="text-xl font-bold text-gray-900">{title}</h1>
      {children}
    </main>
  );
}
