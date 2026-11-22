"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Cake, Gift, Heart, LogIn, ShieldCheck, Sparkles, Store, UserPlus } from "lucide-react";
import { UserManager, WebStorageStateStore, type User } from "oidc-client-ts";
import { API_URL, api, setAccessTokenProvider, setDemoUser, useApi } from "./api";
import { guessCurrency, money, type Currency } from "./format";
import { Avatar, Badge, Button, ErrorState, Logo, Spinner } from "../ui/primitives";
import { VendorVerification } from "../ui/vendor-kyc";
import { BRAND } from "@/lib/brand";

export type AppName = "admin" | "sender" | "recipient" | "vendor";
/** Who is signed in, as this app sees them. `role` is the capacity they act in here (their staff role in Admin). */
/** Seeded sample people and stores use reserved example addresses that real sign-ups can't receive email at. */
export const isSampleEmail = (email: string | null | undefined) => !!email && /(@example\.com|\.example)$/i.test(email);

export type Persona = { id: string; name: string; email: string; role: string; city: string; vendorName?: string | null };
export type Meta = {
  categories: { id: string; name: string; slug: string; emoji: string }[];
  fxRateNgn: number;
  freeSampleLimitUsd: number;
  taxRate: number;
  commissionRate: number;
  deliveryFees: Record<string, number>;
  demoEnabled?: boolean;
  /** Where "Back to {BRAND} home" goes on this deployment (Admin → Settings → Website address, else the server's Site:WebsiteUrl). */
  websiteUrl?: string;
  /** Currencies people can choose, with units per US dollar (sample rates set by SecretWish operations). */
  currencies?: { code: string; name: string; perUsd: number }[];
};
export type VendorSummary = { id: string; name: string; status: "Pending" | "Approved" | "Rejected" | "Suspended"; decisionReason?: string | null };
/** The signed-in account from /api/me. One account can send, receive, run a store and hold a staff role. */
export type Profile = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string;
  /** ISO date (yyyy-mm-dd). Needed before creating wishlists or gifting; set once, then only support can change it. */
  dateOfBirth?: string | null;
  /** Blacklisted by SecretWish: nobody can gift to this account and it can't create wishlists. */
  blacklisted?: boolean;
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
  /** Formats a USD amount in the viewer's chosen currency. */
  fmt: (usd: number | null | undefined, opts?: { compact?: boolean }) => string;
  /** Formats a USD amount in a given currency (e.g. a wishlist's own currency). */
  fmtIn: (usd: number | null | undefined, currency: Currency, opts?: { compact?: boolean }) => string;
  /** Units of `currency` per US dollar. */
  rate: (currency: Currency) => number;
  /** Loads the signed-in profile again (after saving details such as the date of birth). */
  reloadProfile: () => Promise<void>;
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
// Production builds fall back to the live public website; local development uses the Website app on port 3000.
export const WEBSITE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL ?? (process.env.NODE_ENV === "production" ? "https://secretwish-web.vercel.app" : "http://localhost:3000");
const prod = process.env.NODE_ENV === "production";
/** Each app's address when set for this deployment (NEXT_PUBLIC_*_URL). */
const CONFIGURED_APP_URLS: Record<AppName, string | undefined> = {
  admin: process.env.NEXT_PUBLIC_ADMIN_URL,
  sender: process.env.NEXT_PUBLIC_SENDER_URL,
  recipient: process.env.NEXT_PUBLIC_RECIPIENT_URL,
  vendor: process.env.NEXT_PUBLIC_VENDOR_URL,
};
const DEFAULT_APP_URLS: Record<AppName, string> = prod
  ? { admin: "https://secretwish-admin.vercel.app", sender: "https://secretwish-sender.vercel.app", recipient: "https://secretwish-recipient.vercel.app", vendor: "https://secretwish-vendor.vercel.app" }
  : { admin: "http://localhost:3001", sender: "http://localhost:3002", recipient: "http://localhost:3003", vendor: "http://localhost:3004" };

/**
 * Where another SecretWish app lives, seen from app <paramref name="from"/>. The deployment's NEXT_PUBLIC_*_URL wins; otherwise
 * it's worked out from this app's own address (sender-dev.veilwish.com → vendor-dev.veilwish.com, secretwish-sender.vercel.app →
 * secretwish-vendor.vercel.app), so a dev deployment links to the other dev apps, and signs in through the dev API, rather
 * than to production. Only the live production addresses are used as a last resort.
 */
export function appUrl(target: AppName, from: AppName): string {
  const configured = CONFIGURED_APP_URLS[target];
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined" && target !== from) {
    const { protocol, hostname, port } = window.location;
    if (hostname !== "localhost" && hostname !== "127.0.0.1" && hostname.includes(from))
      return `${protocol}//${hostname.replace(from, target)}${port ? `:${port}` : ""}`;
  }
  return DEFAULT_APP_URLS[target];
}
export const APP_NAMES: Record<AppName, string> = { admin: "Admin", sender: "Sender", recipient: "Wishlists", vendor: "Vendor portal" };
const appLinks: { app: AppName; label: string }[] = [
  { app: "sender", label: "Send a gift" },
  { app: "recipient", label: "My wishlists" },
  { app: "vendor", label: "Vendor portal" },
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

/** A sign-in lasts 2 days from when the person signed in (auth_time in the id token), however active they are; the API
 * enforces the same limit and refuses to refresh older sign-ins. Without auth_time (tokens from before the limit) the id token's
 * issue time stands in, so an older API can't send the app round a sign-in loop. */
const SESSION_MAX_MS = 2 * 24 * 60 * 60 * 1000;
function signInExpired(user: User) {
  const at = user.profile.auth_time ?? user.profile.iat;
  return typeof at !== "number" || Date.now() - at * 1000 >= SESSION_MAX_MS;
}

/** Forgets this app's tokens and any half-finished sign-in, then reloads, which asks for a fresh sign-in. */
async function endExpiredSignIn(app: AppName) {
  const mgr = auth(app);
  await mgr.removeUser().catch(() => undefined);
  await mgr.clearStaleState().catch(() => undefined);
  window.location.assign("/");
}

/** Whether a failed token refresh means the sign-in is over (expired or revoked), rather than a network blip. */
function signInRefused(err: unknown) {
  return (err as { error?: string } | null)?.error === "invalid_grant";
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
    const saved = read("secretwish.currency");
    // A saved choice wins; otherwise default to the currency for where the browser is (₦ in Nigeria).
    const metaPromise = api<Meta>("/meta")
      .then((m) => {
        setMeta(m);
        const codes = m.currencies?.map((x) => x.code) ?? ["USD", "NGN"];
        setCurrencyState(saved && codes.includes(saved) ? saved : guessCurrency(codes));
        return m;
      })
      .catch(() => undefined);

    (async () => {
      const mgr = auth(app);
      setAccessTokenProvider(async () => {
        const user = await mgr.getUser();
        if (!user) return null;
        if (signInExpired(user)) {
          await endExpiredSignIn(app);
          return null;
        }
        if (!user.expired) return user.access_token;
        // Access tokens last 15 minutes; swap the refresh token for a new one.
        try {
          return (await mgr.signinSilent())?.access_token ?? null;
        } catch (err) {
          if (signInRefused(err)) await endExpiredSignIn(app);
          return null;
        }
      });
      mgr.events.addSilentRenewError((err) => {
        if (signInRefused(err)) void endExpiredSignIn(app);
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

      let user = await mgr.getUser();
      // Signed in more than 2 days ago: drop the stored tokens and sign in afresh below.
      if (user && signInExpired(user)) {
        await mgr.removeUser();
        await mgr.clearStaleState().catch(() => undefined);
        user = null;
      }
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
    })().catch(() => setState({ status: "error", message: `Can't reach ${BRAND} sign-in. Please check your connection and try again.` }));
  }, [app, demoKey, loadProfile]);

  // A tab left open is signed out when its 2 days are up, not only when it next calls the API.
  useEffect(() => {
    if (state.status !== "signed-in") return;
    const timer = window.setInterval(async () => {
      const user = await auth(app).getUser();
      if (!user || signInExpired(user)) await endExpiredSignIn(app);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [app, state.status]);

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
            fmt: (usd, opts) => money(usd, currency, rateOf(meta, currency), opts),
            fmtIn: (usd, code, opts) => money(usd, code, rateOf(meta, code), opts),
            rate: (code) => rateOf(meta, code),
            reloadProfile: loadProfile,
          }
        : null,
    [app, persona, state, signOut, currency, setCurrency, meta, loadProfile],
  );

  if (state.status === "loading") return <Spinner label={`Opening ${BRAND}`} />;
  if (state.status === "error") return <Centered><ErrorState error={{ message: state.message }} onRetry={() => window.location.assign("/")} /></Centered>;
  if (!value) return <SignInChooser app={app} intro={intro} demoEnabled={!!meta?.demoEnabled} onPick={pickDemo} websiteUrl={meta?.websiteUrl} />;
  return (
    <Ctx.Provider value={value}>
      <AccessGate onProfileChange={loadProfile}>{children}</AccessGate>
    </Ctx.Provider>
  );
}

function rateOf(meta: Meta | undefined, code: Currency) {
  if (code === "USD") return 1;
  return meta?.currencies?.find((c) => c.code === code)?.perUsd ?? (code === "NGN" ? (meta?.fxRateNgn ?? 1550) : 1);
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
        <p className="mt-2 text-sm text-ink-500">You&apos;re signed in as {persona.email || persona.name}, but this account isn&apos;t part of the {BRAND} team. Team access can only be given by a {BRAND} super admin.</p>
        <Button className="mt-5" variant="secondary" onClick={signOut}>Sign out</Button>
      </Centered>
    );
  if (app === "vendor" && profile.vendor?.status !== "Approved") return <OpenYourStore vendor={profile.vendor} onSubmitted={onProfileChange} />;
  if ((app === "sender" || app === "recipient") && !profile.dateOfBirth)
    return (
      <>
        <DateOfBirthPrompt app={app} onSaved={onProfileChange} />
        {children}
      </>
    );
  return <>{children}</>;
}

/** Asks for a date of birth, which is needed before creating wishlists or sending gifts. People can still look around without it. */
function DateOfBirthPrompt({ app, onSaved }: { app: AppName; onSaved: () => Promise<void> }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // SecretWish is 18+, so the picker stops at the latest date of birth that's old enough.
  const latest = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 18); return d.toISOString().slice(0, 10); })();
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!value) return setError("Enter your date of birth.");
    if (value > latest) return setError(`You must be 18 or older to use ${BRAND}.`);
    setBusy(true);
    setError(null);
    try {
      await api("/me/date-of-birth", { method: "PUT", body: { dateOfBirth: value } });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your date of birth.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div role="region" aria-label="Add your date of birth" className="border-b border-gold-300 bg-gold-100 px-4 py-3 text-ink-900">
      <form onSubmit={save} className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
        <Cake aria-hidden className="h-5 w-5 shrink-0 text-plum-700" />
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">Add your date of birth</span> to {app === "recipient" ? "create wishlists (and your birthday wishlist)" : "send gifts"}. You must be 18 or older, and it can only be set once.
        </p>
        <label className="sr-only" htmlFor="dob-prompt">Date of birth</label>
        <input id="dob-prompt" type="date" max={latest} value={value} onChange={(e) => setValue(e.target.value)} autoComplete="bday"
          className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm" />
        <Button size="sm" type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        {error && <p role="alert" className="w-full text-sm text-red-700">{error}</p>}
      </form>
    </div>
  );
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
        {/* Pending stores send their verification documents here; review starts once all three are in. */}
        {vendor?.status === "Pending" && <VendorVerification storeName={vendor.name} />}
        {vendor?.status === "Suspended" && (
          <>
            <h1 className="mt-6 font-display text-2xl font-semibold text-plum-900">Your store is suspended</h1>
            <p className="mt-2 text-sm text-ink-500">{vendor.decisionReason ?? `Please contact ${BRAND} support to find out more.`}</p>
          </>
        )}
        {canApply && (
          <form onSubmit={submit}>
            <h1 className="mt-6 font-display text-2xl font-semibold text-plum-900">Open your store on {BRAND}</h1>
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

/** Which apps the "One SecretWish account" card names. */
const everyApp: { label: string; icon: typeof Gift }[] = [
  { label: "Send", icon: Gift },
  { label: "Wishlists", icon: Heart },
  { label: "Vendors", icon: Store },
  { label: "Team", icon: ShieldCheck },
];

/**
 * The signed-out screen: a dark card with sign-in, sign-up and (in demo mode) the demo personas, beside a plum panel with the app's
 * own headline and a card saying one account works everywhere. Stacks on phones with sign-in first.
 */
function SignInChooser({ app, intro, demoEnabled, onPick, websiteUrl }: { app: AppName; intro: ReactNode; demoEnabled: boolean; onPick: (p: Persona) => void; websiteUrl?: string }) {
  return (
    <main className="min-h-screen bg-[#2a1d31] px-4 py-6 text-ivory-50 sm:px-6 md:py-10">
      <nav aria-label={`Other ${BRAND} apps`} className="mx-auto mb-6 flex max-w-6xl flex-wrap items-center justify-between gap-3 text-[13px] md:mb-4">
        <a href={websiteUrl && websiteUrl !== "/" ? websiteUrl : WEBSITE_URL} className="inline-flex items-center gap-1.5 font-semibold text-plum-200 hover:text-ivory-50">
          <ArrowLeft className="size-4" aria-hidden /> Back to SecretWish home
        </a>
        {app !== "admin" && (
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-plum-300">Switch to</span>
            {appLinks.filter((l) => l.app !== app).map((l) => (
              <a key={l.app} href={appUrl(l.app, app)} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 font-semibold text-ivory-50 hover:border-gold-400 hover:text-gold-400">
                {l.label}
              </a>
            ))}
          </span>
        )}
      </nav>

      <div className="mx-auto max-w-6xl md:pt-14">
        <div className="relative grid overflow-visible rounded-[32px] bg-[#120914] shadow-[0_40px_90px_rgba(0,0,0,0.45)] md:grid-cols-2">
          {/* Soft glow behind the sign-in side. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[32px]">
            <div className="absolute top-1/3 left-[28%] size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(100,58,123,0.55)_0%,rgba(201,164,92,0.12)_40%,transparent_70%)] blur-2xl" />
          </div>

          {/* Sign in */}
          <section aria-labelledby="welcome" className="relative z-10 flex flex-col px-6 py-10 sm:px-12 md:py-14">
            <Logo suffix={app === "admin" ? "Operations" : app === "vendor" ? "Vendor" : undefined} />
            <div className="my-auto max-w-sm pt-10 md:pt-14">
              <h2 id="welcome" className="font-display text-3xl font-semibold sm:text-4xl">Welcome to {BRAND}</h2>
              <p className="mt-2 text-[15px] text-plum-200">Sign in with your {BRAND} account{app === "admin" ? "." : ", or create one in a minute."}</p>
              <div className="mt-8 grid gap-3">
                <button type="button" onClick={() => startSignIn(app)}
                  className="inline-flex h-13 min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-gold-400 to-gold-500 px-5 text-[15px] font-bold text-plum-950 shadow-[0_12px_30px_rgba(201,164,92,0.25)] transition hover:brightness-105 active:translate-y-px">
                  <LogIn className="size-5" aria-hidden /> Sign in
                </button>
                {app === "admin" ? (
                  // Team accounts are created by a super admin; nobody can sign up as staff.
                  <p className="text-xs leading-relaxed text-plum-300">Team accounts are created by a {BRAND} super admin. Sign in with the email they added for you.</p>
                ) : (
                  <button type="button" onClick={() => startSignIn(app, "signup")}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-5 text-[15px] font-semibold text-ivory-50 transition hover:border-white/30 hover:bg-white/10">
                    <UserPlus className="size-5" aria-hidden /> Create an account
                  </button>
                )}
              </div>
              {demoEnabled && <DemoPersonas app={app} onPick={onPick} />}
            </div>
          </section>

          {/* The app's own story, in a lighter panel that rises above the card. */}
          <section aria-label={`About ${BRAND}`} className="relative z-10 p-3 md:-mt-14 md:p-0 md:py-0 md:pr-0">
            <div className="relative flex h-full flex-col overflow-hidden rounded-[28px] bg-gradient-to-br from-plum-500 via-plum-600 to-plum-800 px-7 pt-10 pb-6 sm:px-10 md:pt-16 md:pb-8">
              {/* Notched corner, as on a gift tag. */}
              <span aria-hidden className="absolute -top-px -right-px hidden h-14 w-24 rounded-bl-[28px] bg-[#2a1d31] md:block" />
              <span aria-hidden className="pointer-events-none absolute -right-24 bottom-24 size-72 rounded-full border border-white/10" />
              <span aria-hidden className="pointer-events-none absolute right-10 bottom-40 size-40 rounded-full border border-gold-300/20" />
              <div className="relative max-w-md md:pr-10">{intro}</div>
              <div className="relative mt-auto pt-10 md:pt-16">
                <div className="relative rounded-[24px] bg-ivory-50 p-6 text-ink-900 shadow-[0_24px_50px_rgba(18,9,20,0.35)] md:mr-14">
                  <span aria-hidden className="absolute -top-6 -right-6 grid size-14 place-items-center rounded-full bg-ivory-50 text-plum-800 ring-8 ring-plum-700">
                    <Sparkles className="size-6" />
                  </span>
                  <p className="font-display text-xl leading-snug font-semibold text-plum-900">One {BRAND} account works across every app.</p>
                  <p className="mt-1.5 text-sm text-ink-500">Send surprises, keep wishlists, run a store or help run {BRAND}, all with the same sign-in.</p>
                  <ul className="mt-4 flex flex-wrap gap-2" aria-label="Apps">
                    {everyApp.map(({ label, icon: Icon }) => (
                      <li key={label} className="inline-flex items-center gap-1.5 rounded-full bg-plum-50 px-3 py-1 text-xs font-semibold text-plum-700">
                        <Icon className="size-3.5" aria-hidden /> {label}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function DemoPersonas({ app, onPick }: { app: AppName; onPick: (p: Persona) => void }) {
  const { data, error, loading, reload } = useApi<Persona[]>(`/demo/personas?app=${app}`);
  return (
    <div className="mt-8">
      <div className="flex items-center gap-3 text-xs font-semibold tracking-wider text-plum-300 uppercase">
        <span className="h-px flex-1 bg-white/10" /> Or try a demo persona <span className="h-px flex-1 bg-white/10" />
      </div>
      <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-plum-300">
        <Sparkles className="size-3.5 text-gold-400" aria-hidden /> Synthetic people and data, simulated payments.
      </p>
      <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
        {loading && <Spinner label="Loading personas" />}
        {error && <div className="rounded-2xl bg-ivory-50 text-ink-900"><ErrorState error={error} onRetry={reload} /></div>}
        {data?.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick(p)}
            className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-gold-400/60 hover:bg-white/[0.08]"
          >
            <Avatar name={p.name} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ivory-50">{p.name}</span>
              <span className="block truncate text-xs text-plum-300">{p.vendorName ? `${p.vendorName} · ${p.city}` : `${roleLabels[p.role] ?? p.role} · ${p.city}`}</span>
            </span>
            <span className="text-xs font-semibold text-gold-400">Continue →</span>
          </button>
        ))}
      </div>
    </div>
  );
}
