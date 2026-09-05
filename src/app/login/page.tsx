import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { homePath } from "@/lib/authz";
import { AuthCard } from "@/components/AuthCard";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect(homePath(session.user.role));

  return (
    <main className="stadium-glow flex min-h-screen flex-col items-center justify-center overflow-hidden p-4">
      {/* Floating background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-float absolute -left-32 top-1/4 size-64 rounded-full bg-brand/8 blur-3xl" />
        <div className="animate-float absolute -right-24 top-1/3 size-48 rounded-full bg-gold/8 blur-3xl" style={{ animationDelay: "1.2s" }} />
        <div className="animate-float absolute bottom-1/4 left-1/3 size-56 rounded-full bg-brand/5 blur-3xl" style={{ animationDelay: "2.4s" }} />
      </div>

      {/* Broadcast scan line */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-30">
        <div className="animate-scan absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent" />
      </div>

      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-6">
        {/* Gateway metadata strip */}
        <div className="animate-fade-up flex w-full items-center justify-between rounded-xl border border-line bg-bg-elevated px-4 py-2.5 text-xs shadow-sm" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center gap-2">
            <span className="size-2 animate-pulse rounded-full bg-success" />
            <span className="font-black uppercase tracking-widest text-brand">Gateway Secure</span>
            <span className="hidden text-muted md:inline">| Match Protocol Active</span>
          </div>
          <span className="text-muted">AC-Defense Engaged</span>
        </div>

        {/* Auth card with staggered entrance */}
        <div className="animate-fade-up w-full" style={{ animationDelay: "0.25s" }}>
          <AuthCard mode="login" />
        </div>

        {/* Bottom broadcast ticker */}
        <div className="animate-fade-in flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-muted" style={{ animationDelay: "0.6s" }}>
          <span className="size-1.5 animate-pulse rounded-full bg-brand" />
          Stadium of Elite v2 — Live Match System
          <span className="size-1.5 animate-pulse rounded-full bg-gold" />
        </div>
      </div>
    </main>
  );
}
