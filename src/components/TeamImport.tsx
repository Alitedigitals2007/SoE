"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { importTeamCsvAction } from "@/app/actions/teamImport";
import { Button, Card, CardHeader, Textarea, cn } from "@/components/ui";

type Result = { imported: number; created: { name: string; email: string; password: string }[]; issues: { row: number; message: string }[] };
type Notice = { kind: "ok" | "err"; text: string } | null;

export function TeamImport({ teamId }: { teamId: string }) {
  const [csv, setCsv] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<Notice>(null);
  const [result, setResult] = React.useState<Result | null>(null);
  const router = useRouter();

  return (
    <Card className="mt-5">
      <CardHeader
        title="Import players into this team"
        description="One row per player: name, email, number (1–8), and an optional password. Missing accounts are created as PLAYER logins — use the generated passwords to hand out."
      />
      <div className="space-y-4 p-5">
        <Textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={7}
          spellCheck={false}
          placeholder={"name,email,number,password\nAde Jones,ade@example.com,1,\nKemi Ola,kemi@example.com,2,kemi2026!"}
          className="font-mono text-xs"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setCsv("name,email,number,password\n")}
            disabled={busy}
          >
            Load template
          </Button>
          <Button
            disabled={!csv.trim() || busy}
            loading={busy}
            onClick={() => {
              if (busy) return;
              setBusy(true);
              setNotice(null);
              setResult(null);
              void importTeamCsvAction(teamId, csv).then((r) => {
                setBusy(false);
                if (r.ok && r.data) {
                  setResult(r.data);
                  setNotice({ kind: "ok", text: `Added ${r.data.imported} player(s).` });
                  router.refresh();
                } else if (!r.ok) {
                  setNotice({ kind: "err", text: r.error ?? "Import failed." });
                }
              });
            }}
          >
            Import players
          </Button>
          {notice ? (
            <p className={cn("text-sm", notice.kind === "err" ? "text-danger" : "text-success")}>{notice.text}</p>
          ) : null}
        </div>

        {result ? (
          <div className="space-y-2 text-sm">
            {result.issues.length > 0 ? (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3">
                <p className="font-semibold text-warning">Skipped {result.issues.length} row(s):</p>
                <ul className="mt-1 list-inside list-disc text-xs">
                  {result.issues.map((i, idx) => (
                    <li key={idx}>
                      Row {i.row}: {i.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {result.created.length > 0 ? (
              <div className="rounded-md border border-gold/40 bg-gold/10 p-3">
                <p className="font-semibold text-gold-strong">New accounts created — save these passwords:</p>
                <ul className="mt-1 space-y-1 font-mono text-xs">
                  {result.created.map((c) => (
                    <li key={c.email}>
                      {c.name} · {c.email} · <span className="font-bold">{c.password}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
