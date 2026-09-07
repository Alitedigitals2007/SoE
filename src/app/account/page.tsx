import Link from "next/link";
import { requireRole, homePath } from "@/lib/authz";
import { PublicShell } from "@/components/site";
import { AccountSettings } from "@/components/AccountSettings";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireRole();

  return (
    <PublicShell>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-fg">Account</h1>
            <p className="mt-1 text-muted">Your profile and security settings.</p>
          </div>
          <Link href={homePath(user.role)} className="inline-flex h-10 items-center rounded-lg bg-surface px-4 text-sm font-semibold text-fg hover:bg-line">
            Back to {user.role === "USER" ? "dashboard" : "your dashboard"} →
          </Link>
        </div>
        <div className="mt-6">
          <AccountSettings name={user.name} email={user.email} />
        </div>
      </div>
    </PublicShell>
  );
}
