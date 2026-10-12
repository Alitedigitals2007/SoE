import { prisma } from "@/lib/prisma";
import { AdminNav } from "@/components/admin";
import { ComplaintsManager, type ComplaintRow } from "@/components/admin/ComplaintsManager";

export const dynamic = "force-dynamic";

export default async function AdminComplaintsPage() {
  const raw = await prisma.complaint.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      user: { select: { name: true, email: true } },
      match: { select: { code: true, homeName: true, awayName: true } },
    },
  });

  const complaints: ComplaintRow[] = raw.map((c) => ({
    id: c.id,
    type: c.type,
    subject: c.subject,
    message: c.message,
    status: c.status,
    adminNote: c.adminNote,
    createdAt: c.createdAt.toISOString(),
    playerName: c.user.name,
    playerEmail: c.user.email,
    fixture: c.match
      ? { code: c.match.code, label: `${c.match.homeName} v ${c.match.awayName}` }
      : null,
  }));

  const open = complaints.filter((c) => c.status === "OPEN").length;

  return (
    <>
      <AdminNav />
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <h1 className="text-2xl font-bold text-fg">Player complaints</h1>
        <p className="text-sm text-muted">
          {open} under review · {complaints.length} total. Reply with a note, then resolve or dismiss.
        </p>
        <ComplaintsManager complaints={complaints} />
      </main>
    </>
  );
}
