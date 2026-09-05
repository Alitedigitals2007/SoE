"use client";

import { cn } from "@/components/ui";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

function pageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

export function Pagination({ page, totalPages, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null;
  const pages = pageNumbers(page, totalPages);

  return (
    <nav className={cn("flex items-center justify-center gap-1 pt-4", className)} aria-label="Pagination">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-fg disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted"
      >
        &lt; Prev
      </button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`e${i}`} className="px-2 py-1.5 text-sm text-subtle">
            &hellip;
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={cn(
              "min-w-[2rem] rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              p === page
                ? "bg-gold/15 text-gold-strong border border-gold/30"
                : "text-muted hover:bg-surface hover:text-fg",
            )}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-fg disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted"
      >
        Next &gt;
      </button>
    </nav>
  );
}
