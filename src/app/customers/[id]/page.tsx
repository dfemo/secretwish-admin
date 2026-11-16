"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft, Ban, Banknote, CalendarHeart, CheckCircle2, Gift, Heart, Inbox, LifeBuoy, type LucideIcon, Package, Send, ShieldCheck, Sparkles, Store, UserCog,
} from "lucide-react";
import { api, useApi, useMutation } from "@/shared/lib/api";
import { useSession } from "@/shared/lib/session";
import { useAccess } from "@/lib/access";
import { date, dateTime } from "@/shared/lib/format";
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, ErrorState, KpiCard, Notice, PageSkeleton, Stat, StatusBadge } from "@/shared/ui/primitives";
import { ConfirmDialog, useToast } from "@/shared/ui/overlay";

type Activity = { at: string; kind: string; title: string; detail: string; amountUsd: number | null; link: string };
type Detail = {
  id: string; name: string; email: string | null; phone: string | null; city: string; address: string | null; plan: string; usedFreeSample: boolean;
  memberSince: string; masked: boolean; dateOfBirth: string | null; hasDateOfBirth: boolean;
  blacklist: { at: string; by: string | null; reason: string | null } | null;
  roles: { sender: boolean; recipient: boolean; vendor: { id: string; name: string; status: string } | null; staff: { role: string; isSuperAdmin: boolean } | null };
  sender: {
    giftsSent: number; spendUsd: number; active: number; delivered: number; refunded: number; cashGifts: number; cashUsd: number;
    surpriseRequests: number; openRequests: number; wishesFulfilled: number; wishesInProgress: number; peopleGifted: number; lastSentAt: string | null;
  };
  recipient: {
    wishlists: number; openWishlists: number; wishes: number; wishesFulfilled: number; giftsReceived: number; cashGifts: number; cashUsd: number; birthdayThisYear: boolean;
    allowance: { thisMonth: number; monthlyLimit: number; thisYear: number; yearlyLimit: number | null; sentThisYear: boolean };
  };
  store: { id: string; name: string; status: string; rating: number; onTimeRate: number; orders: number; salesUsd: number; delivered: number; listings: number } | null;
  wishlists: { id: string; title: string; occasion: string | null; visibility: string; createdAt: string; isBirthday: boolean; items: number; fulfilled: number; state: string }[];
  activity: Activity[];
  canManage: boolean;
};

const activityIcon: Record<string, LucideIcon> = {
  sent: Send, "cash-sent": Banknote, received: Gift, "cash-received": Banknote, wishlist: Heart, surprise: Sparkles, ticket: LifeBuoy,
};

/** One customer at a glance: every role their account plays, what they've achieved in each, and everything they've done recently. */
export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: d, error, loading, reload } = useApi<Detail>(`/admin/customers/${id}`);
  const { fmt } = useSession();
  const { can } = useAccess();
  const toast = useToast();
  const [acting, setActing] = useState(false);
  const act = useMutation((key: string, reason: string) => api(`/admin/customers/${id}/${key}`, { method: "POST", body: { body: reason } }));

  if (loading) return <PageSkeleton />;
  if (error || !d) return <ErrorState error={error} onRetry={reload} />;
  const s = d.sender, r = d.recipient;
  const roleCount = [d.roles.sender, d.roles.recipient, !!d.roles.vendor, !!d.roles.staff].filter(Boolean).length;

  return (
    <>
      <Link href="/customers" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-plum-700">
        <ArrowLeft className="size-4" aria-hidden /> Customers
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <Avatar name={d.name} size={56} />
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-semibold text-plum-900">{d.name}</h1>
            <p className="mt-1 text-sm break-all text-ink-500">
              {[d.email, d.phone, d.city].filter(Boolean).join(" · ")} · member since {date(d.memberSince)}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Roles">
              {d.roles.sender && <Badge tone="plum" icon={Send}>Sender</Badge>}
              {d.roles.recipient && <Badge tone="info" icon={Heart}>Recipient</Badge>}
              {d.roles.vendor && <Badge tone="gold" icon={Store}>Vendor · {d.roles.vendor.name}</Badge>}
              {d.roles.staff && <Badge tone="success" icon={UserCog}>{d.roles.staff.role}</Badge>}
              {roleCount === 0 && <Badge tone="neutral">No activity yet</Badge>}
              {roleCount > 1 && <Badge tone="neutral">{roleCount} roles</Badge>}
              <Badge tone={d.plan === "Free" ? "neutral" : "gold"}>{d.plan} plan</Badge>
              {d.blacklist && <Badge tone="danger" icon={Ban}>Blacklisted</Badge>}
            </div>
          </div>
        </div>
        {d.canManage && can("customers.manage") && !d.roles.staff && (
          d.blacklist
            ? <Button variant="secondary" icon={ShieldCheck} onClick={() => setActing(true)}>Lift blacklist</Button>
            : <Button variant="danger" icon={Ban} onClick={() => setActing(true)}>Blacklist</Button>
        )}
      </header>

      {d.masked && <Notice className="mb-4" title="Masked for your role">Contact details and other people&apos;s names are partly hidden.</Notice>}
      {d.blacklist && (
        <Notice className="mb-4" tone="danger" icon={Ban} title={`Blacklisted ${dateTime(d.blacklist.at)}${d.blacklist.by ? ` by ${d.blacklist.by}` : ""}`}>
          {d.blacklist.reason} Nobody can gift to them and they can&apos;t create wishlists.
        </Notice>
      )}
      {!d.hasDateOfBirth && <Notice className="mb-4" tone="warning">No date of birth yet, so they can&apos;t create wishlists or send gifts.</Notice>}

      <Section icon={Send} title="As a sender" empty={!d.roles.sender && "Hasn't sent a gift or asked vendors for a surprise yet."}>
        <KpiCard tint="plum" label="Gifts sent" value={s.giftsSent.toLocaleString()} hint={`${s.delivered} delivered · ${s.active} in progress`} />
        <KpiCard tint="gold" label="Spend" value={fmt(s.spendUsd)} hint={s.refunded ? `${s.refunded} refunded` : "Paid, not refunded"} />
        <KpiCard tint="sage" label="Cash gifts sent" value={s.cashGifts.toLocaleString()} hint={fmt(s.cashUsd)} />
        <KpiCard tint="lavender" label="Wishes fulfilled" value={s.wishesFulfilled.toLocaleString()} hint={s.wishesInProgress ? `${s.wishesInProgress} in progress` : "Confirmed by SecretWish"} />
        <KpiCard tint="plum" label="Surprise requests" value={s.surpriseRequests.toLocaleString()} hint={`${s.openRequests} waiting for quotes`} />
        <KpiCard tint="gold" label="People gifted" value={s.peopleGifted.toLocaleString()} hint={s.lastSentAt ? `Last on ${date(s.lastSentAt)}` : undefined} />
      </Section>

      <Section icon={Heart} title="As a recipient" empty={!d.roles.recipient && "Hasn't made a wishlist or received a gift yet."}>
        <KpiCard tint="plum" label="Wishlists" value={r.wishlists.toLocaleString()} hint={`${r.openWishlists} open${r.birthdayThisYear ? " · birthday list this year" : ""}`} />
        <KpiCard tint="gold" label="Wishes fulfilled" value={`${r.wishesFulfilled} / ${r.wishes}`} />
        <KpiCard tint="sage" label="Gifts received" value={r.giftsReceived.toLocaleString()} />
        <KpiCard tint="lavender" label="Cash received" value={fmt(r.cashUsd)} hint={`${r.cashGifts} cash gift${r.cashGifts === 1 ? "" : "s"}`} />
        <KpiCard
          tint="plum"
          label="Wishlist allowance"
          value={`${r.allowance.thisMonth} / ${r.allowance.monthlyLimit} this month`}
          hint={r.allowance.yearlyLimit != null ? `${r.allowance.thisYear} / ${r.allowance.yearlyLimit} this year (no gift sent yet)` : `${r.allowance.thisYear} this year`}
        />
      </Section>

      {d.store && (
        <Section icon={Store} title="As a vendor" action={<Link href={`/vendors/${d.store.id}`} className="text-sm font-semibold text-plum-700 hover:underline">Open store</Link>}>
          <KpiCard tint="gold" label="Store" value={d.store.name} hint={<StatusBadge status={d.store.status} />} />
          <KpiCard tint="plum" label="Orders" value={d.store.orders.toLocaleString()} hint={`${d.store.delivered} delivered`} />
          <KpiCard tint="sage" label="Sales" value={fmt(d.store.salesUsd)} />
          <KpiCard tint="lavender" label="Live listings" value={d.store.listings.toLocaleString()} hint={`★ ${d.store.rating.toFixed(1)} · ${Math.round(d.store.onTimeRate * 100)}% on time`} />
        </Section>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Recent activity" description="Everything they've done as any role, newest first." />
          {d.activity.length === 0 ? (
            <EmptyState icon={Inbox} title="No activity yet" />
          ) : (
            <ol className="divide-y divide-ink-100">
              {d.activity.map((a, i) => {
                const Icon = activityIcon[a.kind] ?? Package;
                return (
                  <li key={i}>
                    <Link href={a.link} className="flex items-start gap-3 px-5 py-3 hover:bg-ivory-100">
                      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-plum-50 text-plum-700"><Icon className="size-4" aria-hidden /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{a.title}</span>
                        <span className="block text-xs text-ink-500">{a.detail} · {dateTime(a.at)}</span>
                      </span>
                      {a.amountUsd != null && <span className="text-sm font-semibold tabular">{fmt(a.amountUsd)}</span>}
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title={`Wishlists (${d.recipient.wishlists})`} />
            {d.wishlists.length === 0 ? (
              <p className="p-5 text-sm text-ink-500">No wishlists.</p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {d.wishlists.map((w) => (
                  <li key={w.id}>
                    <Link href={`/wishlists/${w.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-ivory-100">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{w.title} {w.isBirthday && <CalendarHeart className="inline size-3.5 text-gold-700" aria-label="Birthday list" />}</span>
                        <span className="block text-xs text-ink-500">{w.occasion ?? "No occasion"} · {w.visibility} · {date(w.createdAt)}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1"><CheckCircle2 className="size-3.5 text-success-700" aria-hidden />{w.fulfilled}/{w.items}</span>
                        <Badge tone={w.state === "Open" ? "plum" : w.state === "Blacklisted" ? "danger" : "neutral"}>{w.state}</Badge>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Account" />
            <dl className="grid grid-cols-2 gap-4 p-5">
              <Stat label="Plan" value={d.plan} />
              <Stat label="Free first gift" value={d.usedFreeSample ? "Used" : "Available"} />
              <Stat label="Date of birth" value={d.dateOfBirth ? date(d.dateOfBirth) : d.hasDateOfBirth ? "Hidden for your role" : "Not set"} />
              <Stat label="City" value={d.city || "—"} />
              {d.address && <Stat label="Address" value={d.address} />}
            </dl>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={acting}
        onClose={() => { setActing(false); act.setError(null); }}
        title={d.blacklist ? `Lift the blacklist on ${d.name}?` : `Blacklist ${d.name}?`}
        description={d.blacklist ? "People will be able to gift to them again." : "Nobody will be able to gift to them from any wishlist (including payments already started), their lists drop out of discovery, and they can't create new ones. They're notified."}
        confirmLabel={d.blacklist ? "Lift blacklist" : "Blacklist customer"}
        tone={d.blacklist ? "primary" : "danger"}
        reasonLabel={d.blacklist ? undefined : "Why are you blacklisting them?"}
        pending={act.pending}
        error={act.error?.message}
        onConfirm={async (reason) => {
          if ((await act.run(d.blacklist ? "unblacklist" : "blacklist", reason)) !== undefined) {
            toast({ tone: "success", title: d.blacklist ? "Blacklist lifted" : "Customer blacklisted" });
            setActing(false);
            reload();
          }
        }}
      />
    </>
  );
}

/** A row of achievement cards for one role, or a short line when they haven't acted in it. */
function Section({ icon: Icon, title, empty, action, children }: { icon: LucideIcon; title: string; empty?: string | false; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-6" aria-label={title}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-plum-900"><Icon className="size-5 text-plum-600" aria-hidden /> {title}</h2>
        {action}
      </div>
      {empty ? <p className="rounded-2xl border border-dashed border-ink-200 px-4 py-3 text-sm text-ink-500">{empty}</p> : <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">{children}</div>}
    </section>
  );
}
