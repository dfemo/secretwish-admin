"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bell, ChevronDown, KeyRound, LogOut, Menu, type LucideIcon, PanelLeftClose, PanelLeftOpen, Search, Sparkles } from "lucide-react";
import { api, useApi, useMutation } from "../lib/api";
import { APP_NAMES, APP_URLS, AUTH_URL, isSampleEmail, useSession, type AppName } from "../lib/session";
import { currencySymbol, timeAgo } from "../lib/format";
import { Avatar, Badge, cx, Logo } from "../ui/primitives";
import { Drawer } from "../ui/overlay";

export type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number | string };
export type NavSection = { title?: string; items: NavItem[] };

/** app: where link opens; null for older notifications, which open in the current app. */
type Notification = { id: string; title: string; body: string; link: string; app: AppName | null; read: boolean; at: string; type: string };

/** The soft, airy page background every app shares (lilac, sky and champagne glows on ivory). */
export const pageBackground =
  "bg-[#f5f1f8] bg-[radial-gradient(1100px_520px_at_6%_-10%,#ecdff5_0%,transparent_60%),radial-gradient(900px_520px_at_100%_-4%,#e3ebf8_0%,transparent_58%),radial-gradient(900px_640px_at_55%_115%,#f7ead6_0%,transparent_60%)] bg-fixed";
/** Frosted surfaces: the sidebar, top bar and round buttons. */
const glass = "border border-white/80 bg-white/70 shadow-[0_1px_2px_rgb(43_23_54/0.04),0_10px_30px_rgb(43_23_54/0.06)] backdrop-blur-xl";
const roundButton = `grid size-10 place-items-center rounded-full text-ink-700 transition hover:bg-white ${glass}`;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

// ---------------- Shared top-bar widgets ----------------
export function NotificationBell({ align = "right" }: { align?: "right" | "left" }) {
  const { data } = useApi<Notification[]>("/me/notifications");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { app: here } = useSession();
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
        className={cx("relative", roundButton)}
      >
        <Bell className="size-[18px]" aria-hidden />
        {unread > 0 && <span className="absolute -top-0.5 -right-0.5 grid min-w-[18px] place-items-center rounded-full bg-danger-600 px-1 text-[10px] leading-[18px] font-bold text-white ring-2 ring-white">{unread}</span>}
      </button>
      {open && (
        <div className={cx("absolute top-12 z-40 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-[22px] border border-white bg-white/95 shadow-[var(--shadow-pop)] backdrop-blur-xl", align === "right" ? "right-0" : "left-0")}>
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
                    // A notification about another role (e.g. a payout for staff) opens in that role's app.
                    if (n.app && n.app !== here) window.location.assign(`${APP_URLS[n.app]}${n.link}`);
                    else router.push(n.link);
                  }}
                  className={cx("flex w-full gap-3 px-4 py-3 text-left hover:bg-plum-50/60", !n.read && "bg-gold-100/30")}
                >
                  <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-gold-500")} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-ink-900">{n.title}</span>
                    <span className="block text-xs text-ink-500">{n.body}</span>
                    <span className="mt-0.5 block text-[11px] text-ink-400">
                      {timeAgo(n.at)}
                      {n.app && n.app !== here && ` · Opens in ${APP_NAMES[n.app]}`}
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

/** Display currency: defaults to where the viewer is and remembers their choice on this device. */
export function CurrencyToggle() {
  const { currency, setCurrency, meta, rate } = useSession();
  const options = meta?.currencies ?? [{ code: "NGN", name: "Nigerian naira", perUsd: rate("NGN") }, { code: "USD", name: "US dollar", perUsd: 1 }];
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Display currency</span>
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        title={currency === "USD" ? "Base currency" : `Converted at ${rate(currency)} ${currency} per $1 (sample rate)`}
        className={cx("h-10 cursor-pointer rounded-full py-0 pr-8 pl-3.5 text-xs font-semibold text-plum-800 focus:ring-2 focus:ring-plum-200", glass)}
      >
        {options.map((c) => (
          <option key={c.code} value={c.code}>
            {currencySymbol(c.code)} {c.code}
          </option>
        ))}
      </select>
    </label>
  );
}

/** compact: avatar only (the name and details are in the menu), for crowded top bars. */
function PersonaMenu({ subtitle, compact }: { subtitle: string; compact?: boolean }) {
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
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={compact ? `Account menu for ${persona.name}` : undefined} className={cx("flex items-center gap-2.5 rounded-full p-1 transition hover:bg-white", !compact && "lg:pr-4", glass)}>
        <Avatar name={persona.name} size={32} />
        <span className={cx("hidden text-left leading-tight whitespace-nowrap", !compact && "lg:block")}>
          <span className="block text-[13px] font-semibold">{persona.name}</span>
          <span className="block text-[11px] text-ink-500">{subtitle}</span>
        </span>
      </button>
      {open && (
        <div className="absolute top-12 right-0 z-40 w-64 rounded-[22px] border border-white bg-white/95 p-2 shadow-[var(--shadow-pop)] backdrop-blur-xl">
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
  // Only demo personas and the seeded sample accounts are looking at sample data; a real account sees its own.
  const { isDemo, persona } = useSession();
  const sample = isDemo || isSampleEmail(persona.email);
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
  // Menu sections fold away to keep the sidebar short. Choices are remembered per browser; until someone chooses, only the
  // section holding the current page is open. Going to a page opens its section, and any section can be folded again.
  const [folds, setFolds] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      setFolds(JSON.parse(localStorage.getItem("secretwish.nav.open") ?? "{}"));
    } catch {}
  }, []);
  const holdsCurrent = (sec: NavSection) => sec.items.some((it) => isActive(pathname, it.href));
  const isOpen = (sec: NavSection) => !sec.title || (folds[sec.title] ?? holdsCurrent(sec));
  const fold = (title: string, open: boolean) =>
    setFolds((f) => {
      const next = { ...f, [title]: open };
      try {
        localStorage.setItem("secretwish.nav.open", JSON.stringify(next));
      } catch {}
      return next;
    });
  // Arriving on a page (by link, search or the address bar) opens its section once; folding it afterwards sticks.
  const current = sections.find((sec) => sec.title && holdsCurrent(sec))?.title;
  useEffect(() => {
    if (current && folds[current] === false) fold(current, true);
    // Only when the page changes, not on every fold.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const nav = (compact: boolean) => (
    <nav aria-label="Main" className={cx("flex-1 overflow-y-auto px-3 py-2 scrollbar-thin", compact ? "space-y-2" : "space-y-2")}>
      {sections.map((s, i) => {
        // The icon-only rail shows every item; the full menu folds by section.
        const open = compact || isOpen(s);
        const waiting = s.items.reduce((n, it) => n + (typeof it.badge === "number" ? it.badge : 0), 0);
        const listId = `nav-${i}`;
        return (
        <div key={i} className={cx(compact && i > 0 && "border-t border-ink-200/60 pt-2", !compact && i > 0 && "border-t border-ink-200/50 pt-2")}>
          {s.title && !compact && (
            <button
              type="button"
              onClick={() => fold(s.title!, !open)}
              aria-expanded={open}
              aria-controls={listId}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-[11px] font-medium text-ink-400 hover:bg-white/60 hover:text-ink-700"
            >
              <span className="flex-1 text-left">{s.title}</span>
              {!open && waiting > 0 && <span className="rounded-full bg-plum-800 px-1.5 text-[10px] font-bold text-white">{waiting}</span>}
              <ChevronDown className={cx("size-3.5 transition-transform", !open && "-rotate-90")} aria-hidden />
            </button>
          )}
          {open && (
          <ul id={listId} className="space-y-0.5 pb-1">
            {s.items.map((it) => {
              const active = isActive(pathname, it.href);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    aria-current={active ? "page" : undefined}
                    title={compact ? it.label : undefined}
                    className={cx(
                      "group flex items-center gap-3 rounded-2xl px-3 py-2 text-[13px] font-medium transition",
                      active
                        ? "bg-white text-ink-900 shadow-[0_1px_2px_rgb(43_23_54/0.05),0_6px_16px_rgb(43_23_54/0.07)]"
                        : "text-ink-700 hover:bg-white/60 hover:text-ink-900",
                      compact && "justify-center px-0 py-2.5",
                    )}
                  >
                    <it.icon className={cx("size-[18px] shrink-0", active ? "text-plum-700" : "text-ink-500 group-hover:text-ink-900")} aria-hidden />
                    {!compact && <span className="flex-1 truncate">{it.label}</span>}
                    {!compact && it.badge !== undefined && it.badge !== 0 && <span className="rounded-full bg-plum-800 px-1.5 py-px text-[10px] font-bold text-white">{it.badge}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
          )}
        </div>
        );
      })}
    </nav>
  );

  return (
    <div className={cx("flex min-h-screen", pageBackground)}>
      <a href="#main" className="sr-only z-50 rounded bg-white px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>
      {/* A floating, frosted sidebar; folds to an icon rail. */}
      <aside className={cx("sticky top-0 hidden h-screen shrink-0 p-3 pr-0 transition-[width] md:block", collapsed ? "w-[88px]" : "w-[268px]")}>
        <div className={cx("flex h-full flex-col rounded-[28px] text-ink-900", glass)}>
          <div className={cx("flex h-16 items-center px-4 text-plum-900", collapsed ? "justify-center" : "justify-between")}>
            <Logo suffix={suffix} compact={collapsed} />
            {!collapsed && (
              <button type="button" onClick={toggle} className="grid size-8 place-items-center rounded-xl text-ink-500 hover:bg-white hover:text-ink-900" aria-label="Collapse sidebar">
                <PanelLeftClose className="size-[18px]" />
              </button>
            )}
          </div>
          {nav(collapsed)}
          {collapsed ? (
            <button type="button" onClick={toggle} className="mx-auto mb-4 grid size-10 place-items-center rounded-xl text-ink-500 hover:bg-white hover:text-ink-900" aria-label="Expand sidebar">
              <PanelLeftOpen className="size-[18px]" />
            </button>
          ) : (
            <SidebarCard sample={sample} />
          )}
        </div>
      </aside>

      <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} label="Navigation">
        <div className={cx("flex h-full flex-col text-ink-900", pageBackground)}>
          <div className="flex h-16 items-center px-5 text-plum-900">
            <Logo suffix={suffix} />
          </div>
          {nav(false)}
          <SidebarCard sample={sample} />
        </div>
      </Drawer>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[72px] items-center gap-2.5 bg-gradient-to-b from-[#f5f1f8] via-[#f5f1f8]/85 to-transparent px-4 md:px-6">
          <button type="button" onClick={() => setMobileOpen(true)} className={cx(roundButton, "md:hidden")} aria-label="Open navigation">
            <Menu className="size-[18px]" />
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
              <Search className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
              <label htmlFor="global-search" className="sr-only">
                Search
              </label>
              <input
                id="global-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={searchPlaceholder}
                className={cx("h-10 w-full rounded-full pr-4 pl-10 text-sm placeholder:text-ink-400 focus:border-plum-300 focus:bg-white focus:outline-none", glass)}
              />
            </form>
          ) : (
            <div className="flex-1" />
          )}
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {sample && (
              <Badge tone="gold" className="hidden lg:inline-flex">
                Sample data
              </Badge>
            )}
            <CurrencyToggle />
            <NotificationBell />
            <PersonaMenu subtitle={subtitle} />
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1680px] min-w-0 flex-1 px-4 pt-2 pb-8 md:px-6 2xl:px-8">
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
    <div className={cx("min-h-screen pb-28 md:pb-0", pageBackground)}>
      <a href="#main" className="sr-only z-50 rounded bg-white px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 px-3 pt-3 md:px-4">
        <div className={cx("mx-auto flex h-16 max-w-6xl items-center gap-3 rounded-[24px] pr-2 pl-4", glass)}>
          <Link href="/" className="shrink-0 text-plum-900" aria-label="SecretWish home">
            <Logo suffix={tagline} />
          </Link>
          {/* Pill tabs, like a segmented control; the current page's icon sits in a dark disc. */}
          <nav aria-label="Main" className="ml-4 hidden items-center gap-1 rounded-full bg-ink-100/60 p-1 md:flex">
            {items.map((it) => {
              const active = isActive(pathname, it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  aria-current={active ? "page" : undefined}
                  title={it.label}
                  className={cx(
                    "inline-flex items-center gap-2 rounded-full p-1 text-[13px] font-semibold whitespace-nowrap transition xl:pr-3.5",
                    active ? "bg-white text-ink-900 shadow-[0_1px_2px_rgb(43_23_54/0.06),0_4px_12px_rgb(43_23_54/0.08)]" : "text-ink-500 hover:bg-white/60 hover:text-ink-900",
                  )}
                >
                  <span className={cx("grid size-7 place-items-center rounded-full", active ? "bg-plum-900 text-ivory-50" : "text-current")}>
                    <it.icon className="size-[15px]" aria-hidden />
                  </span>
                  {/* Labels show on wide screens; in between, icons with the label as a tooltip and for screen readers. */}
                  <span className="sr-only xl:not-sr-only xl:whitespace-nowrap">{it.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <div className="hidden sm:block">
              <CurrencyToggle />
            </div>
            <NotificationBell />
            <PersonaMenu subtitle={persona.city} compact />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl px-4 py-6 md:py-8">
        {children}
      </main>
      {/* Phones: a floating tab bar. */}
      <nav aria-label="Main" className={cx("fixed inset-x-3 bottom-3 z-30 rounded-[26px] px-1.5 py-1.5 md:hidden", glass, "bg-white/85")}>
        <ul className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map((it) => {
            const active = isActive(pathname, it.href);
            return (
              <li key={it.href}>
                <Link href={it.href} aria-current={active ? "page" : undefined} className={cx("flex min-w-0 flex-col items-center gap-1 rounded-[20px] px-0.5 py-1.5 text-[10px] font-semibold", active ? "text-plum-900" : "text-ink-400")}>
                  <span className={cx("grid h-8 w-full max-w-12 place-items-center rounded-full transition", active && "bg-plum-900 text-ivory-50")}>
                    <it.icon className="size-[18px]" aria-hidden />
                  </span>
                  <span className="max-w-full truncate">{it.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/** The card at the foot of the sidebar: what SecretWish promises, and a note when the data is sample data. */
function SidebarCard({ sample }: { sample: boolean }) {
  return (
    <div className="relative m-3 overflow-hidden rounded-[22px] bg-gradient-to-br from-plum-700 via-plum-800 to-plum-950 p-4 text-ivory-50">
      <span aria-hidden className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full border border-white/10" />
      <span aria-hidden className="pointer-events-none absolute -right-4 -bottom-12 size-28 rounded-full bg-gold-500/20 blur-2xl" />
      <span className="relative grid size-8 place-items-center rounded-full bg-white/15">
        <Sparkles className="size-4 text-gold-300" aria-hidden />
      </span>
      <p className="relative mt-3 text-sm font-semibold">Discreet by design</p>
      <p className="relative mt-0.5 text-[11px] leading-relaxed text-plum-200">Every surprise stays a secret until it arrives.</p>
      {sample && <p className="relative mt-3 rounded-full bg-white/10 px-3 py-1.5 text-center text-[11px] font-semibold text-gold-300">Showing sample data</p>}
    </div>
  );
}
