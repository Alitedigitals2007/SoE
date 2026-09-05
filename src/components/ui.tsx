import * as React from "react";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* ---------------------------------- Button --------------------------------- */

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "success"
  | "pitch"
  | "teamA"
  | "teamB";

type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "brand-gradient text-white shadow-[3px_3px_0_rgba(11,32,48,.16)] hover:brightness-105 focus-visible:outline-gold disabled:bg-line disabled:text-subtle disabled:shadow-none",
  secondary:
    "bg-bg-elevated text-fg border-2 border-fg shadow-[2px_2px_0_rgba(11,32,48,.12)] hover:-translate-y-0.5 hover:bg-bg-raised focus-visible:outline-gold disabled:opacity-50 disabled:shadow-none",
  ghost:
    "text-muted hover:text-fg hover:bg-surface focus-visible:outline-gold disabled:opacity-50",
  danger:
    "bg-danger/10 text-danger border-2 border-danger/50 hover:bg-danger/20 focus-visible:outline-danger disabled:opacity-50",
  success:
    "bg-success/10 text-success border-2 border-success/50 hover:bg-success/20 focus-visible:outline-success disabled:opacity-50",
  pitch:
    "bg-pitch text-pitch-ink font-semibold shadow-[3px_3px_0_rgba(11,32,48,.16)] hover:brightness-110 focus-visible:outline-pitch disabled:bg-line disabled:text-subtle disabled:shadow-none",
  teamA:
    "bg-teama/15 text-teama border border-teama/40 hover:bg-teama/25 focus-visible:outline-teama disabled:opacity-50",
  teamB:
    "bg-teamb/15 text-teamb border border-teamb/40 hover:bg-teamb/25 focus-visible:outline-teamb disabled:opacity-50",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-bold transition-all duration-200 active:translate-y-0.5",
        "focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...rest}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}

/* ----------------------------------- Card ---------------------------------- */

export function Card({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border-2 border-fg/15 bg-bg-elevated shadow-[4px_4px_0_rgba(11,32,48,.08)]",
        className,
      )}
      {...rest}
    />
  );
}

export function CardHeader({
  title,
  description,
  aside,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b-2 border-line px-5 py-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-fg">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-xs text-muted">{description}</p>
        ) : null}
      </div>
      {aside}
    </div>
  );
}

/* ---------------------------------- Badge ---------------------------------- */

type BadgeTone =
  | "gold"
  | "pitch"
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "neutral"
  | "teama"
  | "teamb";

const badgeTones: Record<BadgeTone, string> = {
  gold: "bg-gold/15 text-gold-strong border-gold/30",
  pitch: "bg-pitch/15 text-success border-pitch/30",
  success: "bg-success/15 text-success border-success/40",
  danger: "bg-danger/15 text-danger border-danger/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  info: "bg-info/15 text-info border-info/30",
  neutral: "bg-surface text-muted border-line-strong",
  teama: "bg-teama/15 text-teama border-teama/30",
  teamb: "bg-teamb/15 text-teamb border-teamb/30",
};

export function Badge({
  tone = "neutral",
  className,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        badgeTones[tone],
        className,
      )}
      {...rest}
    />
  );
}

/* ---------------------------------- Field ---------------------------------- */

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  error?: string | null;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="text-xs font-semibold uppercase tracking-wider text-muted"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

const controlClasses =
  "w-full rounded-xl border-2 border-fg/15 bg-bg-raised px-4 py-2.5 text-sm text-fg placeholder:text-subtle transition-all duration-200 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 focus:shadow-[0_0_0_4px_rgba(8,122,85,0.08)] disabled:cursor-not-allowed disabled:opacity-60 hover:border-fg/30";

export function Input({
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClasses, "animate-fade-in", className)} {...rest} />;
}

export function Textarea({
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlClasses, "min-h-24 resize-y", className)} {...rest} />;
}

export function Select({
  className,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(controlClasses, "appearance-none pr-10", className)} {...rest}>
        {children}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-muted">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </span>
    </div>
  );
}

/* --------------------------------- Spinner --------------------------------- */

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}

export function PageSpinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-muted" role="status">
      <Spinner className="size-5 text-gold" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/* --------------------------------- States ---------------------------------- */

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong px-6 py-12 text-center",
        className,
      )}
    >
      <p className="text-sm font-semibold text-fg">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function ErrorNotice({
  title = "Something went wrong",
  children,
  className,
}: {
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger",
        className,
      )}
    >
      <p className="font-semibold">{title}</p>
      {children ? <div className="mt-1 text-danger/90">{children}</div> : null}
    </div>
  );
}

export function SuccessNotice({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm text-success",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------ Form row/label ------------------------------ */

export function FormFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 border-t border-line pt-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
