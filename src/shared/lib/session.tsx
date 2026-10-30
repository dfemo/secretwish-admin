"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, LogIn, ShieldCheck, Sparkles, UserPlus } from "lucide-react";
import { UserManager, WebStorageStateStore } from "oidc-client-ts";
import { API_URL, api, setAccessTokenProvider, setDemoUser, useApi } from "./api";
import { money, type Currency } from "./format";
import { Avatar, Badge, Button, ErrorState, Logo, Spinner } from "../ui/primitives";

export type AppName = "admin" | "sender" | "recipient" | "vendor";
/** Who is signed in, as this app sees them. `role` is the capacity they act in here (their staff role in Admin). */
export type Persona = { id: string; name: string; email: string; role: string; city: string; vendorName?: string | null };
export type Meta = {
  categories: { id: string; name: string; slug: string; emoji: string }[];
  fxRateNgn: number;
  freeSampleLimitUsd: number;
  taxRate: number;
  commissionRate: number;
  deliveryFees: Record<string, number>;
  demoEnabled?: boolean;
};
export type VendorSummary = { id: string; name: string; status: "Pending" | "Approved" | "Rejected" | "Suspended"; decisionReason?: string | null };
/** The signed-in account from /api/me. One account can send, receive, run a store and hold a staff role. */
export type Profile = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string;
  staffRole: string | null;
  vendor: VendorSummary | null;
  capabilities: { canSend: boolean; canReceive: boolean; isVendor: boolean; isStaff: boolean };
};

type Session = {
  app: AppName;
  persona: Persona;
  profile: Profile | undefined;
  /** True when signed in as a demo persona rather than a real account. */
  isDemo: boolean;
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

// Browser storage is used only for per-viewer conveniences (demo persona, currency) and the sign-in tokens.
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
    /* storage unavailable — the app still works for this visit */
  }
}

/** The SecretWish sign-in service (the API, or auth.secretwish.com once a custom domain is set up). */
export const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL ?? API_URL;
const CALLBACK_PATH = "/auth/callback";

/** The public website and the other SecretWish apps, so the sign-in screen can send people elsewhere. */
export const WEBSITE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL ?? "http://localhost:3000";
const appLinks: { app: AppName; label: string; href: string }[] = [
  { app: "sender", label: "Send a gift", href: process.env.NEXT_PUBLIC_SENDER_URL ?? "http://localhost:3002" },
  { app: "recipient", label: "My wishlists", href: process.env.NEXT_PUBLIC_RECIPIENT_URL ?? "http://localhost:3003" },
  { app: "vendor", label: "Vendor portal", href: process.env.NEXT_PUBLIC_VENDOR_URL ?? "http://localhost:3004" },
];

let manager: UserManager | null = null;
/** One OpenID Connect client per app; tokens are refreshed in the background with the refresh token. */
function auth(app: AppName) {
  manager ??= new UserManager({
    authority: AUTH_URL,
    client_id: process.env.NEXT_PUBLIC_AUTH_CLIENT_ID ?? app,
    redirect_uri: `${window.location.origin}${CALLBACK_PATH}`,
    post_logout_redirect_uri: `${window.location.origin}/`,
    response_type: "code",
    scope: "openid profile email phone offline_access",
    userStore: new WebStorageStateStore({ store: window.localStorage }),
    automaticSilentRenew: true,
    loadUserInfo: false,
  });
  return manager;
}

/** Sends the browser to the central SecretWish sign-in (or create-account) page and back to this page afterwards. */
function startSignIn(app: AppName, screen?: "signup") {
  const returnTo = window.location.pathname === CALLBACK_PATH ? "/" : window.location.pathname + window.location.search;
  return auth(app).signinRedirect({ state: { returnTo }, extraQueryParams: screen ? { screen } : undefined });
}

const roleLabels: Record<string, string> = {
  OpsAdmin: "Operations admin · full access",
  Finance: "Finance · refunds, payouts, reconciliation",
  Support: "Support agent · masked personal data",
  Sender: "Sender",
  Recipient: "Recipient",
  Vendor: "Vendor",
};

function personaFor(app: AppName, p: Profile): Persona {
  const role = app === "admin" ? (p.staffRole ?? "") : app === "vendor" ? "Vendor" : app === "sender" ? "Sender" : "Recipient";
  return { id: p.id, name: p.name, email: p.email ?? p.phone ?? "", role, city: p.city, vendorName: p.vendor?.name };
}

type State =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "demo"; persona: Persona }
  | { status: "signed-in"; profile: Profile }
  | { status: "error"; message: string };

export function SessionProvider({ app, children, intro }: { app: AppName; children: ReactNode; intro: ReactNode }) {
  const demoKey = `secretwish.${app}.persona`;
  const [state, setState] = useState<State>({ status: "loading" });
  const [currency, setCurrencyState] = useState<Currency>("USD");
  const [meta, setMeta] = useState<Meta>();

  const loadProfile = useCallback(async () => {
    setState({ status: "signed-in", profile: await api<Profile>("/me") });
  }, []);

  useEffect(() => {
    const c = read("secretwish.currency");
    if (c === "NGN" || c === "USD") setCurrencyState(c);
    const metaPromise = api<Meta>("/meta").then((m) => (setMeta(m), m)).catch(() => undefined);

    (async () => {
      const mgr = auth(app);
      setAccessTokenProvider(async () => {
        const user = await mgr.getUser();
        if (!user) return null;
        if (!user.expired) return user.access_token;
        // Access tokens last 15 minutes; swap the refresh token for a new one.
        return (await mgr.signinSilent().catch(() => null))?.access_token ?? null;
      });

      if (window.location.pathname === CALLBACK_PATH) {
        try {
          const user = await mgr.signinRedirectCallback();
          const returnTo = (user.state as { returnTo?: string } | undefined)?.returnTo ?? "/";
          window.location.replace(returnTo.startsWith("/") ? returnTo : "/");
        } catch {
          setState({ status: "error", message: "We couldn't finish signing you in. Please try again." });
        }
        return;
      }

      const user = await mgr.getUser();
      if (user) {
        try {
          await loadProfile();
          return;
        } catch {
          await mgr.removeUser(); // tokens no longer valid (signed out elsewhere); fall through to sign in
        }
      }

      const m = await metaPromise;
      const saved = m?.demoEnabled ? read(demoKey) : null;
      if (saved) {
        try {
          const p = JSON.parse(saved) as Persona;
          setDemoUser(p.id);
          setState({ status: "demo", persona: p });
          return;
        } catch {
          write(demoKey, null);
        }
      }
      // Real deployments go straight to the central sign-in; if you're already signed in to another
      // SecretWish app you'll come straight back. Demo deployments offer a persona picker first.
      if (m?.demoEnabled) setState({ status: "signed-out" });
      else await startSignIn(app);
    })().catch(() => setState({ status: "error", message: "Can't reach SecretWish sign-in. Please check your connection and try again." }));
  }, [app, demoKey, loadProfile]);

  const pickDemo = useCallback(
    (p: Persona) => {
      setDemoUser(p.id);
      write(demoKey, JSON.stringify(p));
      setState({ status: "demo", persona: p });
    },
    [demoKey],
  );

  const signOut = useCallback(() => {
    if (state.status === "demo") {
      setDemoUser(null);
      write(demoKey, null);
      setState({ status: "signed-out" });
      return;
    }
    // Ends the central session too, so every SecretWish app is signed out.
    const mgr = auth(app);
    mgr.getUser().then((u) => mgr.signoutRedirect({ id_token_hint: u?.id_token }));
  }, [app, demoKey, state.status]);

  const setCurrency = useCallback((c: Currency) => {
    write("secretwish.currency", c);
    setCurrencyState(c);
  }, []);

  const persona = state.status === "demo" ? state.persona : state.status === "signed-in" ? personaFor(app, state.profile) : null;
  const value = useMemo<Session | null>(
    () =>
      persona
        ? {
            app,
            persona,
            profile: state.status === "signed-in" ? state.profile : undefined,
            isDemo: state.status === "demo",
            signOut,
            currency,
            setCurrency,
            meta,
            fmt: (usd, opts) => money(usd, currency, meta?.fxRateNgn ?? 1550, opts),
          }
        : null,
    [app, persona, state, signOut, currency, setCurrency, meta],
  );

  if (state.status === "loading") return <Spinner label="Opening SecretWish" />;
  if (state.status === "error") return <Centered><ErrorState error={{ message: state.message }} onRetry={() => window.location.assign("/")} /></Centered>;
  if (!value) return <SignInChooser app={app} intro={intro} demoEnabled={!!meta?.demoEnabled} onPick={pickDemo} />;
  return (
    <Ctx.Provider value={value}>
      <AccessGate onProfileChange={loadProfile}>{children}</AccessGate>
    </Ctx.Provider>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <main className="grid min-h-screen place-items-center bg-plum-950 px-4 text-ivory-50"><div className="w-full max-w-md rounded-3xl bg-ivory-50 p-6 text-ink-900">{children}</div></main>;
}

/**
 * Each app decides who may use it: anyone can send and receive; the vendor portal needs an approved store
 * (or shows how to open one); the admin app needs a staff role. Demo personas are always let through.
 */
function AccessGate({ children, onProfileChange }: { children: ReactNode; onProfileChange: () => Promise<void> }) {
  const { app, profile, isDemo, signOut, persona } = useSession();
  if (isDemo || !profile) return <>{children}</>;
  if (app === "admin" && !profile.staffRole)
    return (
      <Centered>
        <Logo suffix="Operations" />
        <h1 className="mt-6 font-display text-2xl font-semibold text-plum-900">No team access</h1>
        <p className="mt-2 text-sm text-ink-500">You&apos;re signed in as {persona.email || persona.name}, but this account isn&apos;t part of the SecretWish team. An operations admin can give you access.</p>
        <Button className="mt-5" variant="secondary" onClick={signOut}>Sign out</Button>
      </Centered>
    );
  if (app === "vendor" && profile.vendor?.status !== "Approved") return <OpenYourStore vendor={profile.vendor} onSubmitted={onProfileChange} />;
  return <>{children}</>;
}

const storeCities = ["Lagos", "Abuja", "Port Harcourt", "Ibadan", "Enugu", "Kano"];

/** Vendor portal for an account without an approved store: apply, or see where the application stands. */
function OpenYourStore({ vendor, onSubmitted }: { vendor: VendorSummary | null; onSubmitted: () => Promise<void> }) {
  const { persona, signOut, meta } = useSession();
  const categories = meta?.categories.map((c) => c.name) ?? [];
  const [form, setForm] = useState({ storeName: "", category: "", city: storeCities[0], description: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const canApply = !vendor || vendor.status === "Rejected";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api("/vendor-application", { method: "POST", body: { ...form, category: form.category || categories[0] } });
      await onSubmitted();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  const field = "mt-1 w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm";
  return (
    <main className="min-h-screen bg-plum-950 px-4 py-10 text-ivory-50">
      <div className="mx-auto max-w-lg rounded-3xl bg-ivory-50 p-6 text-ink-900 shadow-[var(--shadow-pop)]">
        <Logo suffix="Vendor" />
        {vendor?.status === "Pending" && (
          <>
            <h1 className="mt-6 font-display text-2xl font-semibold text-plum-900">Your store is under review</h1>
            <p className="mt-2 text-sm text-ink-500">Thanks for applying with <strong>{vendor.name}</strong>. Our team checks every store before it can sell; we&apos;ll notify you as soon as it&apos;s approved.</p>
          </>
        )}
        {vendor?.status === "Suspended" && (
          <>
            <h1 className="mt-6 font-display text-2xl font-semibold text-plum-900">Your store is suspended</h1>
            <p className="mt-2 text-sm text-ink-500">{vendor.decisionReason ?? "Please contact SecretWish support to find out more."}</p>
          </>
        )}
        {canApply && (
          <form onSubmit={submit}>
            <h1 className="mt-6 font-display text-2xl font-semibold text-plum-900">Open your store on SecretWish</h1>
            <p className="mt-2 text-sm text-ink-500">Sell gifts to people across Nigeria. Your account stays the same — you can still send and receive gifts too.</p>
            {vendor?.status === "Rejected" && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">Your last application wasn&apos;t approved{vendor.decisionReason ? `: ${vendor.decisionReason}` : "."} You can update it and apply again.</p>}
            <label className="mt-4 block text-sm font-semibold">Store name<input className={field} required maxLength={80} value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} /></label>
            <label className="mt-3 block text-sm font-semibold">What do you sell?<select className={field} value={form.category || categories[0]} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categories.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="mt-3 block text-sm font-semibold">City<select className={field} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}>{storeCities.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="mt-3 block text-sm font-semibold">About your store<textarea className={field} required minLength={20} maxLength={600} rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
            <Button type="submit" className="mt-5 w-full" disabled={pending}>{pending ? "Sending…" : "Apply to sell"}</Button>
          </form>
        )}
        <p className="mt-6 text-xs text-ink-500">Signed in as {persona.email || persona.name}. <button type="button" className="font-semibold text-plum-700 underline" onClick={signOut}>Sign out</button></p>
      </div>
    </main>
  );
}

function SignInChooser({ app, intro, demoEnabled, onPick }: { app: AppName; intro: ReactNode; demoEnabled: boolean; onPick: (p: Persona) => void }) {
  return (
    <main className="min-h-screen bg-plum-950 px-4 py-10 text-ivory-50">
      <nav aria-label="Other SecretWish apps" className="mx-auto mb-8 flex max-w-5xl flex-wrap items-center justify-between gap-3 text-[13px]">
        <a href={WEBSITE_URL} className="inline-flex items-center gap-1.5 font-semibold text-plum-300 hover:text-ivory-50">
          <ArrowLeft className="size-4" aria-hidden /> Back to SecretWish home
        </a>
        {app !== "admin" && (
          <span className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-plum-300">Switch to</span>
            {appLinks.filter((l) => l.app !== app).map((l) => (
              <a key={l.app} href={l.href} className="rounded-full border border-plum-700 px-3 py-1 font-semibold text-ivory-50 hover:border-gold-400 hover:text-gold-400">
                {l.label}
              </a>
            ))}
          </span>
        )}
      </nav>
      <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-[1.1fr_1fr]">
        <div>
          <Logo suffix={app === "admin" ? "Operations" : app === "vendor" ? "Vendor" : undefined} />
          <div className="mt-10">{intro}</div>
          <p className="mt-8 flex items-center gap-2 text-xs text-plum-300">
            <ShieldCheck className="size-4 text-gold-400" aria-hidden /> One SecretWish account works across every app.
          </p>
        </div>
        <div className="rounded-3xl bg-ivory-50 p-6 text-ink-900 shadow-[var(--shadow-pop)]">
          <h2 className="font-display text-xl font-semibold text-plum-900">Welcome to SecretWish</h2>
          <div className="mt-4 grid gap-2">
            <Button icon={LogIn} onClick={() => startSignIn(app)}>Sign in</Button>
            <Button icon={UserPlus} variant="secondary" onClick={() => startSignIn(app, "signup")}>Create an account</Button>
          </div>
          {demoEnabled && <DemoPersonas app={app} onPick={onPick} />}
        </div>
      </div>
    </main>
  );
}

function DemoPersonas({ app, onPick }: { app: AppName; onPick: (p: Persona) => void }) {
  const { data, error, loading, reload } = useApi<Persona[]>(`/demo/personas?app=${app}`);
  return (
    <div className="mt-6 border-t border-ink-200 pt-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-plum-900">Or try a demo persona</h3>
        <Badge tone="gold" icon={Sparkles}>Demo</Badge>
      </div>
      <p className="mt-1 text-xs text-ink-500">Synthetic people and data, simulated payments.</p>
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
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
    </div>
  );
}
