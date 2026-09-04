import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/app";
import { UsersManager, type UserRow } from "@/components/admin";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const user = await requireRole(["ADMIN"]);
  const rows = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  const users: UserRow[] = rows.map((u) => ({
    ...u,
    role: u.role as UserRow["role"],
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <>
      <TopBar name={user.name} role={user.role} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <h1 className="text-2xl font-bold text-fg">Accounts</h1>
        <p className="mb-5 text-sm text-muted">Referees run matches. Players fill the 16 shirts.</p>
        <UsersManager users={users} />
      </main>
    </>
  );
}
