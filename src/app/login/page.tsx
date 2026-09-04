import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { homePath } from "@/lib/authz";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect(homePath(session.user.role));

  return (
    <main className="stadium-glow flex min-h-screen items-center justify-center p-4">
      <LoginForm />
    </main>
  );
}
