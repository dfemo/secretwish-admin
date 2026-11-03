/** An ISO currency code offered by the API (/meta currencies), e.g. "NGN", "USD", "GHS". */
export type Currency = string;

/** Currencies usually shown without decimals because their units are small. */
const wholeUnits = new Set(["NGN", "KES", "GHS"]);
const locales: Record<string, string> = { NGN: "en-NG", GHS: "en-GH", KES: "en-KE", ZAR: "en-ZA", GBP: "en-GB", EUR: "en-IE", CAD: "en-CA", USD: "en-US" };

/** Formats an amount already in `currency` (e.g. a budget exactly as the sender typed it). */
export function moneyIn(amount: number | null | undefined, currency: Currency = "USD", opts?: { compact?: boolean }) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  const whole = wholeUnits.has(currency);
  return new Intl.NumberFormat(locales[currency] ?? "en-US", {
    style: "currency",
    currency,
    notation: opts?.compact ? "compact" : "standard",
    maximumFractionDigits: opts?.compact ? 1 : whole ? 0 : 2,
    minimumFractionDigits: opts?.compact ? 0 : whole ? 0 : 2,
  }).format(amount);
}

/** Prices are stored in USD (platform base currency) and shown in another currency at its rate per US dollar. */
export function money(usd: number | null | undefined, currency: Currency = "USD", perUsd = 1, opts?: { compact?: boolean }) {
  if (usd === null || usd === undefined || Number.isNaN(usd)) return "—";
  return moneyIn(usd * (currency === "USD" ? 1 : perUsd), currency, opts);
}

/** The symbol for a currency, e.g. "₦" or "GH₵", for labelling amount inputs. */
export function currencySymbol(currency: Currency) {
  return new Intl.NumberFormat(locales[currency] ?? "en-US", { style: "currency", currency, currencyDisplay: "narrowSymbol" }).formatToParts(0).find((p) => p.type === "currency")?.value ?? currency;
}

/** A sensible default currency from where the browser says it is (time zone first, then language region), among the currencies
 * SecretWish offers. It knows more currencies than the defaults, so a currency staff add later becomes the default where it's used. */
export function guessCurrency(available: string[]): Currency {
  const byZone: Record<string, string> = {
    "Africa/Lagos": "NGN", "Africa/Accra": "GHS", "Africa/Nairobi": "KES", "Africa/Johannesburg": "ZAR", "Africa/Cairo": "EGP",
    "Africa/Casablanca": "MAD", "Africa/Kampala": "UGX", "Africa/Dar_es_Salaam": "TZS", "Africa/Kigali": "RWF", "Africa/Addis_Ababa": "ETB",
    "Africa/Lusaka": "ZMW", "Africa/Harare": "USD", "Africa/Douala": "XAF", "Africa/Libreville": "XAF", "Africa/Dakar": "XOF",
    "Africa/Abidjan": "XOF", "Africa/Lome": "XOF", "Africa/Porto-Novo": "XOF", "Africa/Bamako": "XOF", "Africa/Ouagadougou": "XOF",
    "Africa/Monrovia": "LRD", "Africa/Freetown": "SLE", "Africa/Banjul": "GMD",
    "Europe/London": "GBP", "Europe/Zurich": "CHF", "Asia/Dubai": "AED", "Asia/Riyadh": "SAR", "Asia/Kolkata": "INR",
    "America/Toronto": "CAD", "America/Vancouver": "CAD", "Australia/Sydney": "AUD", "Australia/Melbourne": "AUD",
  };
  const byRegion: Record<string, string> = {
    NG: "NGN", GH: "GHS", KE: "KES", ZA: "ZAR", EG: "EGP", MA: "MAD", UG: "UGX", TZ: "TZS", RW: "RWF", ET: "ETB", ZM: "ZMW",
    CM: "XAF", GA: "XAF", SN: "XOF", CI: "XOF", TG: "XOF", BJ: "XOF", ML: "XOF", BF: "XOF", LR: "LRD", SL: "SLE", GM: "GMD",
    GB: "GBP", CA: "CAD", US: "USD", AU: "AUD", AE: "AED", SA: "SAR", IN: "INR", CH: "CHF",
    IE: "EUR", DE: "EUR", FR: "EUR", NL: "EUR", ES: "EUR", IT: "EUR", BE: "EUR", PT: "EUR",
  };
  // Most specific first; the first one SecretWish offers wins.
  const candidates: (string | undefined)[] = [];
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    candidates.push(byZone[zone]);
    const region = new Intl.Locale(navigator.language).maximize().region;
    candidates.push(region ? byRegion[region] : undefined);
    if (zone.startsWith("Europe/")) candidates.push("EUR");
  } catch {
    /* fall through to the default */
  }
  return candidates.find((c): c is string => !!c && available.includes(c)) ?? (available.includes("NGN") ? "NGN" : "USD");
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
