"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { api, setDemoUser, useApi } from "./api";
import { money, type Currency } from "./format";
import { Avatar, Badge, Button, ErrorState, Logo, Spinner } from "../ui/primitives";

export type AppName = "admin" | "sender" | "recipient" | "vendor";
export type Persona = { id: string; name: string; email: string; role: string; city: string; vendorName?: string | null };
export type Meta = {
  categories: { id: string; name: string; slug: string; emoji: string }[];
  fxRateNgn: number;
  freeSampleLimitUsd: number;
  taxRate: number;
  commissionRate: number;
  deliveryFees: Record<string, number>;
};

type Session = {
  app: AppName;
  persona: Persona;
  signOut: () => void;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  meta: Meta | undefined;
  fmt: (usd: number | null | undefined, opts?: { compact?: boolean }) => string;
};

const Ctx = createContext<Session | null>(null);

export function useSession() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSession outside SessionProvider");
  return s;
}

// Browser storage is used only for per-viewer conveniences (chosen persona, currency).
function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — fine for a demo */
  }
}

const roleLabels: Record<string, string> = {
  OpsAdmin: "Operations admin · full access",
  Finance: "Finance · refunds, payouts, reconciliation",
  Support: "Support agent · masked personal data",
  Sender: "Sender",
  Recipient: "Recipient",
  Vendor: "Vendor",
};

export function SessionProvider({ app, children, intro }: { app: AppName; children: ReactNode; intro: ReactNode }) {
  const key = `secretwish.${app}.persona`;
  const [persona, setPersona] = useState<Persona | null>(null);
  const [ready, setReady] = useState(false);
  const [currency, setCurrencyState] = useState<Currency>("USD");
  const [meta, setMeta] = useState<Meta>();

  useEffect(() => {
    const saved = read(key);
    if (saved) {
      try {
        const p = JSON.parse(saved) as Persona;
        setDemoUser(p.id);
        setPersona(p);
      } catch {
        write(key, null);
      }
    }
    const c = read("secretwish.currency");
    if (c === "NGN" || c === "USD") setCurrencyState(c);
    setReady(true);
    api<Meta>("/meta").then(setMeta).catch(() => {});
  }, [key]);

  const signIn = useCallback(
    (p: Persona) => {
      setDemoUser(p.id);
      write(key, JSON.stringify(p));
      setPersona(p);
    },
    [key],
  );
  const signOut = useCallback(() => {
    setDemoUser(null);
    write(key, null);
    setPersona(null);
  }, [key]);
  const setCurrency = useCallback((c: Currency) => {
    write("secretwish.currency", c);
    setCurrencyState(c);
  }, []);

  const value = useMemo<Session | null>(
    () =>
      persona
        ? { app, persona, signOut, currency, setCurrency, meta, fmt: (usd, opts) => money(usd, currency, meta?.fxRateNgn ?? 1550, opts) }
        : null,
    [app, persona, signOut, currency, setCurrency, meta],
  );

  if (!ready) return <Spinner label="Opening SecretWish" />;
  if (!value) return <DemoSignIn app={app} onPick={signIn} intro={intro} />;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function DemoSignIn({ app, onPick, intro }: { app: AppName; onPick: (p: Persona) => void; intro: ReactNode }) {
  const { data, error, loading, reload } = useApi<Persona[]>(`/demo/personas?app=${app}`);
  return (
    <main className="min-h-screen bg-plum-950 px-4 py-10 text-ivory-50">
      <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-[1.1fr_1fr]">
        <div>
          <Logo suffix={app === "admin" ? "Operations" : app === "vendor" ? "Vendor" : undefined} />
          <div className="mt-10">{intro}</div>
          <p className="mt-8 flex items-center gap-2 text-xs text-plum-300">
            <ShieldCheck className="size-4 text-gold-400" aria-hidden /> Prototype · synthetic people and data · simulated payments
          </p>
        </div>
        <div className="rounded-3xl bg-ivory-50 p-6 text-ink-900 shadow-[var(--shadow-pop)]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-plum-900">Choose a demo persona</h2>
            <Badge tone="gold">Demo sign-in</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-500">There is no real authentication in this prototype. Pick who you want to be.</p>
          <div className="mt-5 space-y-2">
            {loading && <Spinner label="Loading personas" />}
            {error && <ErrorState error={error} onRetry={reload} />}
            {data?.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPick(p)}
                className="flex w-full items-center gap-3 rounded-2xl border border-ink-200 bg-white p-3 text-left transition hover:border-plum-300 hover:bg-plum-50"
              >
                <Avatar name={p.name} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{p.name}</span>
                  <span className="block truncate text-xs text-ink-500">{p.vendorName ? `${p.vendorName} · ${p.city}` : `${roleLabels[p.role] ?? p.role} · ${p.city}`}</span>
                </span>
                <span className="text-xs font-semibold text-plum-700">Continue →</span>
              </button>
            ))}
          </div>
          {data && data.length > 0 && (
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => onPick(data[0])}>
              Use the first persona
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
