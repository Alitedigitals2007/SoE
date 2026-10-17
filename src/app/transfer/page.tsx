import { prisma } from "@/lib/prisma";
import { PublicShell } from "@/components/site";
import { Badge, Button } from "@/components/ui";

export const dynamic = "force-dynamic";

type ListingRow = {
  id: string;
  playerName: string;
  teamName: string;
  teamCode: string;
  askingPrice: number;
  status: string;
  window: string;
  season: string;
  isOpen: boolean;
};

export default async function TransferPage() {
  const [windows, listings] = await Promise.all([
    prisma.transferWindow.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, season: true, name: true, status: true, openAt: true, closeAt: true },
    }),
    prisma.transferListing.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        askingPrice: true,
        status: true,
        createdAt: true,
        player: { select: { name: true, imageUrl: true } },
        team: { select: { name: true, code: true } },
        window: { select: { name: true, season: true, status: true } },
      },
      take: 50,
    }),
  ]);

  const rows: ListingRow[] = listings.map((l) => ({
    id: l.id,
    playerName: l.player.name,
    teamName: l.team.name,
    teamCode: l.team.code,
    askingPrice: l.askingPrice,
    status: l.status,
    window: l.window.name,
    season: l.window.season,
    isOpen: l.window.status === "OPEN",
  }));

  const openWindow = windows.find((w) => w.status === "OPEN");

  return (
    <PublicShell>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-black tracking-tight text-fg">Transfer window</h1>
        <p className="mt-1 text-muted">
          Players are listed for transfer in virtual points. The buying club pays the asking price — it is not
          credited to the selling player&rsquo;s account wallet.
        </p>

        <div className="mt-6 rounded-2xl border-2 border-fg/15 bg-bg-elevated p-5">
          <h2 className="text-sm font-black uppercase tracking-wider text-fg mb-3">Windows</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {windows.map((w) => {
              const now = new Date();
              const open = w.status === "OPEN" && (!w.openAt || w.openAt <= now) && (!w.closeAt || w.closeAt >= now);
              return (
                <div key={w.id} className="rounded-xl border-2 p-3 text-center">
                  <p className="text-[10px] font-black uppercase tracking-wider text-muted">{w.season}</p>
                  <p className="font-black text-fg">{w.name}</p>
                  <Badge tone={open ? "success" : "neutral"}>
                    {open ? "Open" : w.status === "CLOSED" ? "Closed" : "Draft"}
                  </Badge>
                </div>
              );
            })}
            {windows.length === 0 && <p className="text-sm text-muted">No transfer windows yet.</p>}
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-black uppercase tracking-wider text-fg mb-3">Listings</h2>
          {!openWindow ? (
            <p className="rounded-2xl border-2 border-dashed border-fg/20 bg-bg-elevated p-10 text-center text-sm text-muted">
              No open transfer window — listings appear when a window opens.
            </p>
          ) : (
            <>
              <div className="rounded-xl border border-line bg-white p-3 overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-line/60">
                      <th className="text-left text-xs font-black uppercase tracking-wider text-muted pb-2">Player</th>
                      <th className="text-left text-xs font-black uppercase tracking-wider text-muted pb-2">Club</th>
                      <th className="text-right text-xs font-black uppercase tracking-wider text-muted pb-2">Asking price</th>
                      <th className="text-left text-xs font-black uppercase tracking-wider text-muted pb-2">Window</th>
                      <th className="text-left text-xs font-black uppercase tracking-wider text-muted pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {rows.filter((r) => r.isOpen).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted">
                          No active listings right now.
                        </td>
                      </tr>
                    ) : (
                      rows.filter((r) => r.isOpen).map((r) => (
                        <tr key={r.id}>
                          <td className="px-4 py-2.5 flex items-center gap-2">
                            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-muted">
                              {r.playerName.slice(0, 1).toUpperCase()}
                            </span>
                            <span className="font-medium text-fg">{r.playerName}</span>
                          </td>
                          <td className="px-4 py-2.5 text-muted">
                            {r.teamName} <span className="text-[10px] font-black text-fg">{r.teamCode}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-bold text-fg">{r.askingPrice} pts</td>
                          <td className="px-4 py-2.5 text-muted">{r.window}</td>
                          <td className="px-4 py-2.5">
                            <Badge tone={r.status === "LISTED" ? "info" : r.status === "SOLD" ? "success" : "danger"}>
                              {r.status}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <p className="text-xs text-muted">Asking prices are in virtual points — paid by the buying club.</p>
              <Button variant="secondary" disabled>
                Make an offer
              </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </PublicShell>
  );
}
