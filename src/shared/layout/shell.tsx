"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bell, ChevronsLeft, ChevronsRight, KeyRound, LogOut, Menu, type LucideIcon, Search } from "lucide-react";
import { api, useApi, useMutation } from "../lib/api";
import { AUTH_URL, useSession } from "../lib/session";
import { timeAgo } from "../lib/format";
import { Avatar, Badge, cx, Logo } from "../ui/primitives";
import { Drawer } from "../ui/overlay";

export type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number | string };
export type NavSection = { title?: string; items: NavItem[] };

type Notification = { id: string; title: string; body: string; link: string; read: boolean; at: string; type: string };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

// ---------------- Shared top-bar widgets ----------------
export function NotificationBell({ align = "right" }: { align?: "right" | "left" }) {
  const { data } = useApi<Notification[]>("/me/notifications");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const markAll = useMutation(() => api("/me/notifications/read-all", { method: "POST" }));
  const markOne = useMutation((id: string) => api(`/me/notifications/${id}/read`, { method: "POST" }));
  const unread = data?.filter((n) => !n.read).length ?? 0;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        className="relative grid size-10 place-items-center rounded-xl text-ink-700 hover:bg-ink-100"
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && <span className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-danger-600 px-1 text-[10px] font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <div className={cx("absolute top-12 z-40 w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-ink-200 bg-white shadow-[var(--shadow-pop)]", align === "right" ? "right-0" : "left-0")}>
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            <button type="button" className="text-xs font-semibold text-plum-700 hover:underline disabled:opacity-40" disabled={!unread} onClick={() => markAll.run()}>
              Mark all read
            </button>
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {data?.length === 0 && <li className="px-4 py-8 text-center text-sm text-ink-500">You&apos;re all caught up.</li>}
            {data?.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!n.read) markOne.run(n.id);
                    setOpen(false);
                    router.push(n.link);
                  }}
                  className={cx("flex w-full gap-3 px-4 py-3 text-left hover:bg-plum-50/60", !n.read && "bg-gold-100/30")}
                >
                  <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-gold-500")} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-ink-900">{n.title}</span>
                    <span className="block text-xs text-ink-500">{n.body}</span>
                    <span className="mt-0.5 block text-[11px] text-ink-400">
                      {timeAgo(n.at)}
                      {!n.read && <span className="sr-only"> · unread</span>}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="border-t border-ink-100 px-4 py-2 text-[11px] text-ink-400">In-app notifications (simulated delivery service)</p>
        </div>
      )}
    </div>
  );
}

export function CurrencyToggle() {
  const { currency, setCurrency, meta } = useSession();
  return (
    <div className="flex items-center rounded-xl bg-ink-100 p-0.5 text-xs font-semibold" role="group" aria-label="Display currency">
      {(["USD", "NGN"] as const).map((c) => (
        <button
          key={c}
          type="button"
          aria-pressed={currency === c}
          onClick={() => setCurrency(c)}
          title={c === "NGN" ? `Converted at ₦${meta?.fxRateNgn ?? "…"} / $1 (sample rate)` : "Base currency"}
          className={cx("rounded-lg px-2.5 py-1.5", currency === c ? "bg-white text-plum-800 shadow-sm" : "text-ink-500")}
        >
          {c === "USD" ? "$ USD" : "₦ NGN"}
        </button>
      ))}
    </div>
  );
}

function PersonaMenu({ subtitle }: { subtitle: string }) {
  const { persona, signOut, isDemo } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center gap-2.5 rounded-xl p-1 pr-2 hover:bg-ink-100">
        <Avatar name={persona.name} size={34} />
        <span className="hidden text-left leading-tight lg:block">
          <span className="block text-[13px] font-semibold">{persona.name}</span>
          <span className="block text-[11px] text-ink-500">{subtitle}</span>
        </span>
      </button>
      {open && (
        <div className="absolute top-12 right-0 z-40 w-64 rounded-2xl border border-ink-200 bg-white p-2 shadow-[var(--shadow-pop)]">
          <div className="px-3 py-2">
            <p className="text-sm font-semibold">{persona.name}</p>
            <p className="truncate text-xs text-ink-500">{persona.email}</p>
            {isDemo && (
              <Badge tone="gold" className="mt-2">
                Demo persona
              </Badge>
            )}
          </div>
          {!isDemo && (
            <a href={`${AUTH_URL}/account/manage`} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-100">
              <KeyRound className="size-4" aria-hidden /> Sign-in and security
            </a>
          )}
          <button type="button" onClick={signOut} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-100">
            <LogOut className="size-4" aria-hidden /> {isDemo ? "Switch persona" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------- Sidebar shell (Admin & Vendor) ----------------
export function SidebarShell({ sections, children, suffix, subtitle, searchPlaceholder, onSearch }: { sections: NavSection[]; children: ReactNode; suffix: string; subtitle: string; searchPlaceholder?: string; onSearch?: (q: string) => void }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [q, setQ] = useState("");
  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("secretwish.sidebar") === "collapsed");
    } catch {}
  }, []);
  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("secretwish.sidebar", c ? "open" : "collapsed");
      } catch {}
      return !c;
    });
  };

  const nav = (compact: boolean) => (
    <nav aria-label="Main" className="flex-1 space-y-5 overflow-y-auto px-3 py-4 scrollbar-thin">
      {sections.map((s, i) => (
        <div key={i}>
          {s.title && !compact && <p className="mb-1.5 px-3 text-[10px] font-semibold tracking-[0.12em] text-plum-300/80 uppercase">{s.title}</p>}
          <ul className="space-y-0.5">
            {s.items.map((it) => {
              const active = isActive(pathname, it.href);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    aria-current={active ? "page" : undefined}
                    title={compact ? it.label : undefined}
                    className={cx(
                      "group flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors",
                      active ? "bg-gold-500/15 text-gold-300" : "text-plum-100/80 hover:bg-white/5 hover:text-white",
                      compact && "justify-center px-0",
                    )}
                  >
                    <it.icon className={cx("size-[18px] shrink-0", active ? "text-gold-400" : "text-plum-300 group-hover:text-white")} aria-hidden />
                    {!compact && <span className="flex-1 truncate">{it.label}</span>}
                    {!compact && it.badge !== undefined && it.badge !== 0 && <span className="rounded-full bg-gold-500 px-1.5 text-[10px] font-bold text-plum-950">{it.badge}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only z-50 rounded bg-white px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>
      <aside className={cx("sticky top-0 hidden h-screen shrink-0 flex-col bg-plum-950 text-ivory-50 transition-[width] md:flex", collapsed ? "w-[76px]" : "w-64")}>
        <div className={cx("flex h-16 items-center border-b border-white/5 px-4", collapsed ? "justify-center" : "justify-between")}>
          <Logo suffix={suffix} compact={collapsed} />
          {!collapsed && (
            <button type="button" onClick={toggle} className="rounded-lg p-1.5 text-plum-300 hover:bg-white/10 hover:text-white" aria-label="Collapse sidebar">
              <ChevronsLeft className="size-4" />
            </button>
          )}
        </div>
        {nav(collapsed)}
        {collapsed && (
          <button type="button" onClick={toggle} className="m-3 grid place-items-center rounded-lg p-2 text-plum-300 hover:bg-white/10 hover:text-white" aria-label="Expand sidebar">
            <ChevronsRight className="size-4" />
          </button>
        )}
        {!collapsed && <p className="border-t border-white/5 px-5 py-3 text-[11px] text-plum-300/70">Prototype · synthetic data</p>}
      </aside>

      <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} label="Navigation">
        <div className="flex h-full flex-col bg-plum-950 text-ivory-50">
          <div className="flex h-16 items-center px-4">
            <Logo suffix={suffix} />
          </div>
          {nav(false)}
        </div>
      </Drawer>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ink-200/70 bg-white/85 px-4 backdrop-blur md:px-6">
          <button type="button" onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-ink-700 hover:bg-ink-100 md:hidden" aria-label="Open navigation">
            <Menu className="size-5" />
          </button>
          {onSearch ? (
            <form
              className="relative hidden max-w-md flex-1 sm:block"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                onSearch(q);
              }}
            >
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
              <label htmlFor="global-search" className="sr-only">
                Search
              </label>
              <input
                id="global-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-10 w-full rounded-xl border border-transparent bg-ink-100/70 pr-3 pl-9 text-sm placeholder:text-ink-400 focus:border-plum-300 focus:bg-white focus:outline-none"
              />
            </form>
          ) : (
            <div className="flex-1" />
          )}
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <Badge tone="gold" className="hidden lg:inline-flex">
              Sample data
            </Badge>
            <CurrencyToggle />
            <NotificationBell />
            <PersonaMenu subtitle={subtitle} />
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

// ---------------- Consumer shell (Sender & Recipient) ----------------
export function ConsumerShell({ items, children, tagline }: { items: NavItem[]; children: ReactNode; tagline?: string }) {
  const pathname = usePathname();
  const { persona } = useSession();
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <a href="#main" className="sr-only z-50 rounded bg-white px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-ink-200/60 bg-ivory-50/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link href="/" className="text-plum-900" aria-label="SecretWish home">
            <Logo suffix={tagline} />
          </Link>
          <nav aria-label="Main" className="ml-6 hidden items-center gap-1 md:flex">
            {items.map((it) => {
              const active = isActive(pathname, it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  aria-current={active ? "page" : undefined}
                  className={cx("rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors", active ? "bg-plum-800 text-ivory-50" : "text-ink-700 hover:bg-plum-50")}
                >
                  {it.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="hidden sm:block">
              <CurrencyToggle />
            </div>
            <NotificationBell />
            <PersonaMenu subtitle={persona.city} />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl px-4 py-6 md:py-10">
        {children}
      </main>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white/95 backdrop-blur md:hidden">
        <ul className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map((it) => {
            const active = isActive(pathname, it.href);
            return (
              <li key={it.href}>
                <Link href={it.href} aria-current={active ? "page" : undefined} className={cx("flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold", active ? "text-plum-800" : "text-ink-400")}>
                  <it.icon className={cx("size-5", active && "text-plum-700")} aria-hidden />
                  {it.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
