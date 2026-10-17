import { cn } from "@/components/ui";

export function SetupStep({
  href,
  n,
  label,
  detail,
  done,
}: {
  href: string;
  n: number;
  label: string;
  detail: string;
  done: boolean;
}) {
  return (
    <a
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 transition-colors",
        done ? "border-success/40 bg-success/5 hover:bg-success/10" : "border-line bg-bg-elevated hover:border-fg/30",
      )}
    >
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full text-xs font-black",
          done ? "bg-success text-white" : "bg-surface text-muted",
        )}
      >
        {done ? "✓" : n}
      </span>
      <span className="min-w-0">
        <span className={cn("block truncate text-xs font-black uppercase tracking-wider", done ? "text-success" : "text-fg")}>
          {label}
        </span>
        <span className="block text-[11px] text-muted">{detail}</span>
      </span>
    </a>
  );
}

export function SetupChecklist({ missing }: { missing: string[] }) {
  if (missing.length === 0) {
    return (
      <p className="mt-4 rounded-xl border-2 border-success/50 bg-success/10 px-4 py-3 text-sm font-semibold text-success">
        ✓ Everything is set — the referee can kick off.
      </p>
    );
  }
  return (
    <div className="mt-4 rounded-xl border-2 border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
      <p className="font-semibold">Still needed before kick-off:</p>
      <ul className="mt-1 list-inside list-disc space-y-0.5">
        {missing.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}
