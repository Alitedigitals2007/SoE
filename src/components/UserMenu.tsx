"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/actions/auth";
import { cn } from "@/components/ui";

export function UserMenu({
  name,
  roleHome,
  roleLabel,
}: {
  name: string;
  roleHome: string;
  roleLabel: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?";

  const onDashboard = pathname === roleHome || pathname.startsWith(`${roleHome}/`);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Account menu for ${name}`}
        className={cn(
          "flex h-10 items-center gap-2 rounded-lg border-2 px-2 transition-colors",
          open ? "border-fg bg-surface" : "border-transparent hover:border-fg/20 hover:bg-surface",
        )}
      >
        <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full brand-gradient text-[11px] font-black text-white">
          {initials}
        </span>
        <span className="hidden max-w-[8rem] truncate text-xs font-bold text-fg sm:inline">{name}</span>
        <span aria-hidden className="text-[8px] text-muted">{open ? "▲" : "▼"}</span>
      </button>

      {open ? (
        <div className="animate-pop absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border-2 border-fg bg-bg-elevated p-2 shadow-[4px_4px_0_rgba(11,32,48,.15)]">
          <div className="px-2 pb-1.5 pt-1">
            <p className="truncate text-sm font-black text-fg">{name}</p>
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-subtle">{roleLabel}</p>
          </div>
          <div className="my-1 h-px bg-line" />
          <Link
            href={roleHome}
            onClick={() => setOpen(false)}
            aria-current={onDashboard ? "page" : undefined}
            className={cn(
              "block rounded-lg px-2.5 py-2 text-xs font-black uppercase tracking-wider transition-colors",
              onDashboard ? "bg-fg text-white" : "text-muted hover:bg-surface hover:text-fg",
            )}
          >
            Dashboard
          </Link>
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            aria-current={pathname === "/account" ? "page" : undefined}
            className={cn(
              "block rounded-lg px-2.5 py-2 text-xs font-black uppercase tracking-wider transition-colors",
              pathname === "/account" ? "bg-fg text-white" : "text-muted hover:bg-surface hover:text-fg",
            )}
          >
            Account settings
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="block w-full rounded-lg px-2.5 py-2 text-left text-xs font-black uppercase tracking-wider text-danger transition-colors hover:bg-danger/10"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
