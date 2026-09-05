import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { homePath } from "@/lib/authz";
import { AuthCard } from "@/components/AuthCard";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) redirect(homePath(session.user.role));

  return (
    <main className="stadium-glow flex min-h-screen flex-col items-center justify-center p-4">
      {/* Gateway metadata strip */}
      <div className="mb-6 flex w-full max-w-md items-center justify-between rounded-xl border border-line bg-bg-elevated px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="size-2 animate-pulse rounded-full bg-success" />
          <span className="font-black uppercase tracking-widest text-brand">Gateway Secure</span>
          <span className="hidden text-muted md:inline">| Registration Open</span>
        </div>
        <span className="text-muted">Free Fan Account</span>
      </div>

      <AuthCard mode="register" />


    </main>
  );
}
