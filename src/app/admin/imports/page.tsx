import Link from "next/link";
import { requireRole } from "@/lib/authz";
import { TopBar } from "@/components/app";
import { ImportCenter } from "@/components/ImportCenter";

export const dynamic = "force-dynamic";

export default async function AdminImportsPage() {
  const user = await requireRole(["ADMIN"]);
  return (
    <>
      <TopBar name={user.name} role={user.role} />
      <main className="mx-auto w-full max-w-7xl px-4 py-7">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="section-kicker">Operations desk</p>
            <h1 className="mt-2 font-display text-4xl font-black uppercase tracking-tight text-fg">Import centre</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Load accounts, squads, questions and fixtures in bulk. Every file is previewed and validated before the database is touched.
            </p>
          </div>
          <Link href="/admin" className="text-sm font-bold text-brand hover:underline">
            ← Back to admin
          </Link>
        </div>
        <ImportCenter />
      </main>
    </>
  );
}
