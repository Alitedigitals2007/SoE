import { cn } from "@/components/ui";

/**
 * Player avatar: profile photo when present, otherwise initials on the
 * club-colour disc. Used across players pages, dashboards and match screens.
 */
export function Avatar({
  name,
  src,
  size = 40,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const initials =
    name
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className={cn("shrink-0 rounded-full object-cover ring-2 ring-line", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-full bg-brand/15 font-black text-brand-deep ring-2 ring-line", className)}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) }}
    >
      {initials}
    </span>
  );
}
