export type Currency = "USD" | "NGN";

/** Prices are stored in USD (platform base currency) and shown in local currency at the recorded FX rate. */
export function money(usd: number | null | undefined, currency: Currency = "USD", fx = 1550, opts?: { compact?: boolean }) {
  if (usd === null || usd === undefined || Number.isNaN(usd)) return "—";
  const value = currency === "NGN" ? usd * fx : usd;
  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-US", {
    style: "currency",
    currency,
    notation: opts?.compact ? "compact" : "standard",
    maximumFractionDigits: opts?.compact ? 1 : currency === "NGN" ? 0 : 2,
    minimumFractionDigits: opts?.compact ? 0 : currency === "NGN" ? 0 : 2,
  }).format(value);
}

export function number(n: number | null | undefined) {
  return n === null || n === undefined ? "—" : new Intl.NumberFormat("en-US").format(n);
}

export function pct(n: number | null | undefined, digits = 1) {
  return n === null || n === undefined ? "—" : `${n.toFixed(digits)}%`;
}

export function date(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function shortDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function dateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return "—";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 0) {
    const f = -s;
    if (f < 3600) return `in ${Math.max(1, Math.round(f / 60))}m`;
    if (f < 86400) return `in ${Math.round(f / 3600)}h`;
    return `in ${Math.round(f / 86400)}d`;
  }
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)}d ago`;
  return date(iso);
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function humanize(s: string) {
  return s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
