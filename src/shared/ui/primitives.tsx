"use client";

import Link from "next/link";
import { forwardRef, useId, type ComponentProps, type ReactNode } from "react";
import { AlertCircle, ArrowDownRight, ArrowUpRight, Inbox, Loader2, type LucideIcon, RefreshCw } from "lucide-react";
import { statusMeta, tintClasses, toneClasses, type Tone } from "../lib/status";
import { initials } from "../lib/format";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

// ---------------- Button ----------------
type Variant = "primary" | "secondary" | "ghost" | "gold" | "danger" | "subtle";
const variants: Record<Variant, string> = {
  primary: "bg-plum-800 text-ivory-50 hover:bg-plum-700 shadow-sm",
  gold: "bg-gold-500 text-plum-950 hover:bg-gold-400 shadow-sm",
  secondary: "bg-white text-plum-800 ring-1 ring-inset ring-ink-200 hover:bg-plum-50",
  subtle: "bg-plum-50 text-plum-800 hover:bg-plum-100",
  ghost: "text-ink-700 hover:bg-ink-100",
  danger: "bg-danger-600 text-white hover:bg-danger-700 shadow-sm",
};
const sizes = { sm: "h-8 px-3 text-xs gap-1.5", md: "h-10 px-4 text-sm gap-2", lg: "h-12 px-6 text-[15px] gap-2" };

type ButtonProps = ComponentProps<"button"> & { variant?: Variant; size?: keyof typeof sizes; loading?: boolean; icon?: LucideIcon };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon: Icon, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : Icon ? <Icon className="size-4" aria-hidden /> : null}
      {children}
    </button>
  );
});

export function ButtonLink({ href, variant = "primary", size = "md", icon: Icon, className, children }: { href: string; variant?: Variant; size?: keyof typeof sizes; icon?: LucideIcon; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={cx("inline-flex items-center justify-center rounded-xl font-semibold transition-colors whitespace-nowrap", variants[variant], sizes[size], className)}>
      {Icon && <Icon className="size-4" aria-hidden />}
      {children}
    </Link>
  );
}

// ---------------- Surfaces ----------------
export function Card({ className, children, ...rest }: Omit<ComponentProps<"section">, "ref">) {
  return (
    <section className={cx("rounded-2xl border border-ink-200/70 bg-white shadow-[var(--shadow-card)]", className)} {...rest}>
      {children}
    </section>
  );
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-wrap items-start justify-between gap-3 px-5 pt-5", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-ink-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-medium text-ink-500">{eyebrow}</div>}
        <h1 className="font-display text-[28px] leading-tight font-semibold text-plum-900 md:text-[32px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

// ---------------- Badges ----------------
export function Badge({ tone = "neutral", icon: Icon, children, className }: { tone?: Tone; icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset whitespace-nowrap", toneClasses[tone], className)}>
      {Icon && <Icon className="size-3" aria-hidden />}
      {children}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  const m = statusMeta(status);
  return (
    <Badge tone={m.tone} icon={m.icon} className={className}>
      {m.label}
    </Badge>
  );
}

export function SampleDataBadge() {
  return (
    <Badge tone="gold" className="uppercase tracking-wide">
      Sample data
    </Badge>
  );
}

// ---------------- KPI ----------------
const kpiTints = {
  plum: "bg-plum-50 border-plum-100",
  gold: "bg-gold-100/60 border-gold-100",
  sage: "bg-sage-tint/70 border-sage-tint",
  rose: "bg-rose-tint/70 border-rose-tint",
  ivory: "bg-ivory-200/60 border-ivory-200",
  lavender: "bg-lavender-tint/60 border-lavender-tint",
  white: "bg-white border-ink-200/70",
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  delta,
  hint,
  tint = "white",
  href,
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  delta?: number | null;
  hint?: ReactNode;
  tint?: keyof typeof kpiTints;
  href?: string;
}) {
  const body = (
    <div className={cx("h-full rounded-2xl border p-4 transition-shadow", kpiTints[tint], href && "hover:shadow-[var(--shadow-card)]")}>
      <div className="flex items-start justify-between gap-2">
        {Icon && (
          <span className="grid size-9 place-items-center rounded-xl bg-white/80 text-plum-700 shadow-sm">
            <Icon className="size-[18px]" aria-hidden />
          </span>
        )}
        {delta !== undefined && delta !== null && (
          <span className={cx("inline-flex items-center gap-0.5 text-[11px] font-semibold", delta >= 0 ? "text-success-700" : "text-danger-700")}>
            {delta >= 0 ? <ArrowUpRight className="size-3" aria-hidden /> : <ArrowDownRight className="size-3" aria-hidden />}
            {Math.abs(delta)}%<span className="sr-only">{delta >= 0 ? " increase" : " decrease"} vs previous period</span>
          </span>
        )}
      </div>
      <div className="mt-3 text-[22px] leading-none font-bold tracking-tight text-ink-900 tabular">{value}</div>
      <div className="mt-1.5 text-xs font-medium text-ink-500">{label}</div>
      {hint && <div className="mt-1 text-[11px] text-ink-400">{hint}</div>}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

// ---------------- Forms ----------------
export function Field({ label, hint, error, children, required, className }: { label: string; hint?: ReactNode; error?: string | null; children: (id: string, describedBy?: string) => ReactNode; required?: boolean; className?: string }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  return (
    <div className={cx("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-[13px] font-semibold text-ink-700">
        {label}
        {required && <span className="text-danger-600"> *</span>}
      </label>
      {children(id, [hintId, errId].filter(Boolean).join(" ") || undefined)}
      {hint && !error && (
        <p id={hintId} className="text-xs text-ink-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="flex items-center gap-1 text-xs font-medium text-danger-700" role="alert">
          <AlertCircle className="size-3.5" aria-hidden /> {error}
        </p>
      )}
    </div>
  );
}

const inputBase =
  "w-full rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400 transition-colors hover:border-ink-300 focus:border-plum-500 focus:outline-none focus:ring-2 focus:ring-plum-200 disabled:bg-ink-50 aria-[invalid=true]:border-danger-600";

export const Input = forwardRef<HTMLInputElement, ComponentProps<"input">>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(inputBase, "h-10", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea">>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(inputBase, "min-h-[88px] py-2.5", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, ComponentProps<"select">>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cx(inputBase, "h-10 pr-8", className)} {...rest}>
      {children}
    </select>
  );
});

export function Switch({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div>
        <label htmlFor={id} className="text-sm font-semibold text-ink-900">
          {label}
        </label>
        {description && <p className="text-xs text-ink-500">{description}</p>}
      </div>
      <button
        id={id}
        role="switch"
        type="button"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx("relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50", checked ? "bg-plum-700" : "bg-ink-300")}
      >
        <span className={cx("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")} />
      </button>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search…", label = "Search", className }: { value: string; onChange: (v: string) => void; placeholder?: string; label?: string; className?: string }) {
  return (
    <div className={cx("relative", className)}>
      <label className="sr-only" htmlFor={`search-${label}`}>
        {label}
      </label>
      <svg className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input id={`search-${label}`} type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cx(inputBase, "h-10 pl-9")} />
    </div>
  );
}

// ---------------- Tabs ----------------
export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { value: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cx("flex gap-1 overflow-x-auto rounded-xl bg-ink-100/80 p-1 scrollbar-thin", className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          type="button"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cx(
            "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors",
            value === t.value ? "bg-white text-plum-800 shadow-sm" : "text-ink-500 hover:text-ink-900",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className={cx("rounded-full px-1.5 text-[10px]", value === t.value ? "bg-plum-100 text-plum-700" : "bg-ink-200 text-ink-700")}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ---------------- Feedback states ----------------
export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-500" role="status">
      <Loader2 className="size-5 animate-spin text-plum-500" aria-hidden /> {label}…
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-xl bg-ink-100", className)} aria-hidden />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      <Skeleton className="h-9 w-64" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }: { icon?: LucideIcon; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-plum-50 text-plum-600">
        <Icon className="size-6" aria-hidden />
      </span>
      <h3 className="mt-4 text-[15px] font-semibold text-ink-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: { message: string } | null; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-danger-600/20 bg-danger-50/60 px-6 py-12 text-center" role="alert">
      <AlertCircle className="size-7 text-danger-600" aria-hidden />
      <h3 className="mt-3 text-[15px] font-semibold text-ink-900">We couldn&apos;t load this</h3>
      <p className="mt-1 max-w-md text-sm text-ink-700">{error?.message ?? "Something went wrong."}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" icon={RefreshCw} className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Notice({ tone = "info", title, children, icon: Icon = AlertCircle, className }: { tone?: Tone; title?: ReactNode; children?: ReactNode; icon?: LucideIcon; className?: string }) {
  return (
    <div className={cx("flex gap-3 rounded-xl px-4 py-3 text-sm ring-1 ring-inset", toneClasses[tone], className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-[13px] opacity-90">{children}</div>}
      </div>
    </div>
  );
}

// ---------------- Identity & product art ----------------
export function Avatar({ name, size = 36, className }: { name: string; size?: number; className?: string }) {
  return (
    <span
      className={cx("inline-grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-plum-600 to-plum-800 font-semibold text-gold-300", className)}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/** Synthetic product imagery: an emoji on a soft tinted tile (no third-party photos in the prototype). */
export function ProductArt({ emoji, tint = "lavender", size = "md", className, label }: { emoji: string; tint?: string; size?: "sm" | "md" | "lg" | "xl"; className?: string; label?: string }) {
  const s = { sm: "size-10 text-xl rounded-xl", md: "size-14 text-3xl rounded-xl", lg: "aspect-square w-full text-6xl rounded-2xl", xl: "aspect-[4/3] w-full text-7xl rounded-2xl" }[size];
  return (
    <span role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} className={cx("grid shrink-0 place-items-center", tintClasses[tint] ?? "bg-lavender-tint", s, className)}>
      <span className="drop-shadow-sm">{emoji}</span>
    </span>
  );
}

export function Logo({ suffix, compact }: { suffix?: string; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-plum-950 shadow-sm" aria-hidden>
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="8" width="18" height="13" rx="2" />
          <path d="M12 8v13M3 12h18M12 8c-1.5-3-5-3.5-5-1s3 1 5 1c2 0 5 1.5 5-1s-3.5-2-5 1z" />
        </svg>
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="font-display text-lg font-semibold tracking-tight">SecretWish</span>
          {suffix && <span className="ml-1.5 align-middle text-[10px] font-semibold tracking-[0.14em] text-gold-500 uppercase">{suffix}</span>}
        </span>
      )}
    </span>
  );
}

export function Stat({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-ink-900 tabular">{value}</dd>
    </div>
  );
}
