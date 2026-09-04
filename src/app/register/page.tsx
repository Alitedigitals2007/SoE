import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { homePath } from "@/lib/authz";
import { AuthCard } from "@/components/AuthCard";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) redirect(homePath(session.user.role));

  return (
    <main className="stadium-glow flex min-h-screen items-center justify-center p-4">
      <AuthCard mode="register" />
    </main>
  );
}
