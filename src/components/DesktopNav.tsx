"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRIMARY_NAV, SECONDARY_NAV } from "@/lib/nav";
import { cn } from "@/components/ui";

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopNav() {
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

  const moreActive = SECONDARY_NAV.some((n) => isActive(pathname, n.href));

  return (
    <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary">
      {PRIMARY_NAV.map((n) => {
        const active = isActive(pathname, n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative rounded-lg px-2.5 py-2 text-[.72rem] font-black uppercase tracking-wider transition-colors",
              active ? "bg-surface text-fg" : "text-muted hover:bg-surface hover:text-fg",
            )}
          >
            {n.label}
            {active ? (
              <span aria-hidden className="absolute inset-x-2.5 -bottom-[5px] h-[3px] rounded-full brand-gradient" />
            ) : null}
          </Link>
        );
      })}

      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="true"
          className={cn(
            "flex items-center gap-1 rounded-lg px-2.5 py-2 text-[.72rem] font-black uppercase tracking-wider transition-colors",
            open || moreActive ? "bg-surface text-fg" : "text-muted hover:bg-surface hover:text-fg",
          )}
        >
          More
          <span aria-hidden className="text-[8px]">{open ? "▲" : "▼"}</span>
        </button>

        {open ? (
          <div className="animate-pop absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-2xl border-2 border-fg bg-bg-elevated p-2 shadow-[4px_4px_0_rgba(11,32,48,.15)]">
            <p className="px-2 pb-1 pt-1 text-[10px] font-black uppercase tracking-[.18em] text-subtle">Explore</p>
            <div className="grid grid-cols-2 gap-1">
              {SECONDARY_NAV.map((n) => {
                const active = isActive(pathname, n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "rounded-lg px-2.5 py-2 text-[.68rem] font-black uppercase tracking-wider transition-colors",
                      active ? "bg-fg text-white" : "text-muted hover:bg-surface hover:text-fg",
                    )}
                  >
                    {n.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
