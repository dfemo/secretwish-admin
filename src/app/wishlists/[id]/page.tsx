"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Ban, CheckCircle2, Heart, Lock, LockOpen, PieChart, ShieldCheck, Undo2, Users } from "lucide-react";
import { api, useApi, useMutation } from "@/shared/lib/api";
import { useSession } from "@/shared/lib/session";
import { date, dateTime } from "@/shared/lib/format";
import { Badge, Button, Card, CardHeader, cx, ErrorState, KpiCard, Notice, PageSkeleton, Stat, StatusBadge } from "@/shared/ui/primitives";
import { DataTable, type Column } from "@/shared/ui/data";
import { ConfirmDialog, useToast } from "@/shared/ui/overlay";

/** Who is fulfilling a wish (one sender at a time) and how far: Claimed → SenderCompleted → RecipientConfirmed → Confirmed (fulfilled). */
type Claim = {
  status: "Open" | "Claimed" | "SenderCompleted" | "RecipientConfirmed" | "Confirmed"; stage: string; sender: string | null;
  claimedAt: string | null; senderCompletedAt: string | null; recipientConfirmedAt: string | null; confirmedAt: string | null; confirmedBy: string | null;
  canConfirm: boolean; canRelease: boolean; canMarkPartial: boolean;
};
/** Cash wishes: what was asked for, what's been paid so far and the difference still to come. */
type CashProgress = { requestedUsd: number | null; raisedUsd: number; remainingUsd: number | null; partial: boolean; partiallyFulfilledAt: string | null; partiallyFulfilledBy: string | null };
type Item = { id: string; kind: string; name: string; quantity: number; fulfilled: boolean; notes: string; priceUsd: number | null; giftCount: number; label: string | null; claim: Claim; cash: CashProgress | null };
type Gift = { id: string; kind: "Order" | "Cash"; reference: string; amountUsd: number; at: string; status: string; sender: string; item: string | null };
type Gifter = { sender: string; gifts: number; amountUsd: number; last: string };
type Request = { id: string; reference: string; title: string; status: string; createdAt: string; budgetMin: number; budgetMax: number; quotes: number; accepted: boolean; sender: string };
/** Thanks / NoLongerNeeded: closed by the owner with a message for gifters. Staff: closed by SecretWish with an internal reason. */
type Closed = { at: string; by: string; reason: string | null; kind: "Thanks" | "NoLongerNeeded" | "Staff"; byOwner: boolean; note: string | null; notePublic: boolean };
type Detail = {
  id: string; title: string; description: string; occasion: string | null; eventDate: string | null; visibility: string; currency: string; createdAt: string;
  owner: { id: string; name: string; email: string; city: string };
  state: "Open" | "Fulfilled" | "Closed";
  closed: Closed | null;
  isBirthday: boolean;
  /** Blacklisted by SecretWish (the list itself, or its owner's account): nobody can gift from it. */
  blacklist: { list: boolean; owner: boolean; at: string; by: string | null; reason: string | null } | null;
  stats: {
    items: number; fulfilled: number; gifts: number; gifters: number; givenUsd: number;
    orders: number; ordersUsd: number; deliveredOrders: number; cash: number; cashUsd: number; cashReceived: number; requests: number; unsuccessful: number;
  };
  items: Item[];
  gifts: Gift[];
  gifters: Gifter[];
  /** Orders and cash gifts from the list that never completed: unpaid, failed, cancelled or refunded. */
  unsuccessful: Gift[];
  requests: Request[];
  canManage: boolean;
};

type Action = "close" | "reopen" | "blacklist" | "unblacklist" | "confirm" | "release" | "partial";
const dialog: Record<Action, { title: (item?: string) => string; description: string; confirm: string; done: string; reason?: string; danger?: boolean }> = {
  close: { title: () => "Close this wishlist?", description: "No more senders will be able to gift from it, and open sourcing requests for it are closed. The owner is notified and this is recorded in the audit log.", confirm: "Close wishlist", done: "Wishlist closed", reason: "Why are you closing it?", danger: true },
  reopen: { title: () => "Reopen this wishlist?", description: "Senders will be able to gift from it again. The owner is notified.", confirm: "Reopen wishlist", done: "Wishlist reopened" },
  blacklist: { title: () => "Blacklist this wishlist?", description: "Nobody will be able to gift from it, including payments already started, and it drops out of discovery. The owner is notified.", confirm: "Blacklist wishlist", done: "Wishlist blacklisted", reason: "Why are you blacklisting it?", danger: true },
  unblacklist: { title: () => "Lift the blacklist?", description: "Senders will be able to gift from this list again. The owner is notified.", confirm: "Lift blacklist", done: "Blacklist lifted" },
  confirm: { title: (item) => `Confirm “${item}” was fulfilled?`, description: "The sender marked it completed and the owner confirmed receiving it. Confirming marks the wish fulfilled for good.", confirm: "Confirm fulfilled", done: "Wish confirmed" },
  partial: { title: (item) => `Mark “${item}” partly fulfilled?`, description: "What's been paid stays counted towards the wish. Whoever holds it now lets go, and other senders can send the rest. The sender and the owner are told.", confirm: "Mark partly fulfilled", done: "Marked partly fulfilled" },
  release: { title: (item) => `Release “${item}”?`, description: "The sender holding this wish loses it and anyone can gift it again. Use this when a claim is stuck or was abandoned.", confirm: "Release wish", done: "Wish released", reason: "Why are you releasing it?", danger: true },
};

const closureLabel: Record<Closed["kind"], string> = { Thanks: "Thank-you", NoLongerNeeded: "No longer needed", Staff: "Closed by staff" };

export default function WishlistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: d, error, loading, reload } = useApi<Detail>(`/admin/wishlists/${id}`);
  const { fmt } = useSession();
  const toast = useToast();
  const [acting, setActing] = useState<{ key: Action; item?: Item } | null>(null);
  const act = useMutation((key: Action, reason: string, itemId?: string) =>
    api(itemId ? `/admin/wishlist-items/${itemId}/${key}` : `/admin/wishlists/${id}/${key}`, { method: "POST", body: { body: reason } }));

  if (loading) return <PageSkeleton />;
  if (error || !d) return <ErrorState error={error} onRetry={reload} />;

  // The campaign from start to finish, oldest first.
  const timeline = [
    { at: d.createdAt, title: "Wishlist created", detail: `by ${d.owner.name}` },
    ...d.requests.map((r) => ({ at: r.createdAt, title: `Sourcing request ${r.reference}`, detail: `${r.sender} asked vendors for “${r.title}” · ${r.quotes} quote${r.quotes === 1 ? "" : "s"} · ${r.status}` })),
    ...d.gifts.map((g) => ({ at: g.at, title: `${g.kind === "Cash" ? "Cash gift" : "Gift"} ${g.reference}`, detail: `${g.sender} · ${fmt(g.amountUsd)}${g.item ? ` · ${g.item}` : ""} · ${g.status}` })),
    ...d.unsuccessful.map((g) => ({ at: g.at, title: `${g.kind === "Cash" ? "Cash gift" : "Gift"} ${g.reference} didn't go through`, detail: `${g.sender} · ${fmt(g.amountUsd)} · ${g.status}` })),
    ...(d.closed ? [{ at: d.closed.at, title: d.closed.byOwner ? "Closed by the owner" : "Closed by VeilWish (SecretWish)", detail: `${d.closed.by} · ${closureLabel[d.closed.kind]}` }] : []),
  ].sort((a, b) => a.at.localeCompare(b.at));

  const itemCols: Column<Item>[] = [
    { key: "n", header: "Wish", render: (i) => (<div><p className="font-semibold">{i.name}</p><p className="text-xs text-ink-500">{i.kind}{i.quantity > 1 ? ` · ×${i.quantity}` : ""}{i.notes ? ` · ${i.notes}` : ""}</p></div>) },
    {
      key: "p",
      header: "Price",
      align: "right",
      render: (i) =>
        i.cash ? (
          // Cash wishes: asked for, paid so far, and the difference.
          <div className="space-y-0.5 @3xl:text-right">
            <p className="font-semibold">{i.cash.requestedUsd != null ? fmt(i.cash.requestedUsd) : "Any amount"}</p>
            <p className="text-xs text-success-700">{fmt(i.cash.raisedUsd)} paid</p>
            {i.cash.remainingUsd != null && i.cash.remainingUsd > 0 && <p className="text-xs font-semibold text-warning-700">{fmt(i.cash.remainingUsd)} to go</p>}
          </div>
        ) : i.priceUsd != null ? fmt(i.priceUsd) : "—",
    },
    { key: "g", header: "Gifted", render: (i) => (i.label ? <Badge tone={i.giftCount > 1 ? "plum" : "success"}>{i.label}</Badge> : i.fulfilled ? <Badge tone="success">Gifted</Badge> : <span className="text-xs text-ink-400">Not yet</span>) },
    {
      key: "f",
      header: "Fulfilment",
      render: (i) => (
        <div className="space-y-1">
          <Badge tone={i.claim.status === "Confirmed" ? "success" : i.claim.status === "RecipientConfirmed" ? "gold" : i.claim.status === "Open" ? "neutral" : "plum"}>
            {i.claim.status === "SenderCompleted" ? "Awaiting owner" : i.claim.stage}
          </Badge>
          {i.claim.sender && <p className="text-xs text-ink-500">by {i.claim.sender}</p>}
          {i.cash?.partial && (
            <p className="text-xs text-ink-500">
              Partly fulfilled: {fmt(i.cash.raisedUsd)} of {fmt(i.cash.requestedUsd ?? 0)}, difference {fmt(i.cash.remainingUsd ?? 0)}
              {i.cash.partiallyFulfilledBy && <> · marked by {i.cash.partiallyFulfilledBy}{i.cash.partiallyFulfilledAt && ` ${date(i.cash.partiallyFulfilledAt)}`}</>}
            </p>
          )}
          {d.canManage && (i.claim.canConfirm || i.claim.canRelease || i.claim.canMarkPartial) && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {i.claim.canConfirm && <Button size="sm" icon={CheckCircle2} onClick={() => setActing({ key: "confirm", item: i })}>Confirm</Button>}
              {i.claim.canMarkPartial && <Button size="sm" variant="secondary" icon={PieChart} onClick={() => setActing({ key: "partial", item: i })}>Partly fulfilled</Button>}
              {i.claim.canRelease && <Button size="sm" variant="ghost" icon={Undo2} onClick={() => setActing({ key: "release", item: i })}>Release</Button>}
            </div>
          )}
        </div>
      ),
    },
  ];
  const giftCols: Column<Gift>[] = [
    { key: "r", header: "Gift", render: (g) => (g.kind === "Order" ? <Link href={`/orders/${g.id}`} className="font-semibold text-plum-700 hover:underline">{g.reference}</Link> : <span className="font-semibold">{g.reference}</span>) },
    { key: "k", header: "Type", render: (g) => (g.kind === "Cash" ? "Cash gift" : "Order") },
    { key: "s", header: "From", render: (g) => g.sender },
    { key: "i", header: "Wish", render: (g) => g.item ?? <span className="text-xs text-ink-400">Not for a specific wish</span> },
    { key: "a", header: "Amount", align: "right", render: (g) => fmt(g.amountUsd) },
    { key: "st", header: "Status", render: (g) => <StatusBadge status={g.status} /> },
    { key: "at", header: "Date", render: (g) => <span className="text-xs whitespace-nowrap">{dateTime(g.at)}</span> },
  ];
  const gifterCols: Column<Gifter>[] = [
    { key: "s", header: "Gifter", render: (g) => <span className="font-semibold">{g.sender}</span> },
    { key: "g", header: "Gifts", align: "right", render: (g) => g.gifts },
    { key: "a", header: "Given", align: "right", render: (g) => fmt(g.amountUsd) },
    { key: "l", header: "Last gift", render: (g) => <span className="text-xs whitespace-nowrap">{date(g.last)}</span> },
  ];
  const requestCols: Column<Request>[] = [
    { key: "r", header: "Request", render: (r) => (<div><Link href={`/requests/${r.id}`} className="font-semibold text-plum-700 hover:underline">{r.reference}</Link><p className="text-xs text-ink-500">{r.title}</p></div>) },
    { key: "s", header: "From", render: (r) => r.sender },
    { key: "b", header: "Budget", align: "right", render: (r) => `${fmt(r.budgetMin)}–${fmt(r.budgetMax)}` },
    { key: "q", header: "Quotes", align: "right", render: (r) => r.quotes },
    { key: "st", header: "Status", render: (r) => (r.accepted ? <Badge tone="success">Quote accepted</Badge> : <StatusBadge status={r.status} />) },
  ];

  return (
    <>
      <Link href="/wishlists" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-plum-700">
        <ArrowLeft className="size-4" aria-hidden /> Wishlists
      </Link>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-semibold text-plum-900">{d.title}</h1>
            <Badge tone={d.state === "Closed" ? "neutral" : d.state === "Fulfilled" ? "success" : "plum"}>{d.state}</Badge>
            <StatusBadge status={d.visibility} />
            {d.stats.gifters > 1 && <Badge tone="plum" icon={Users}>Multiple gifters</Badge>}
            {d.isBirthday && <Badge tone="gold">Birthday list</Badge>}
            {d.blacklist && <Badge tone="danger" icon={Ban}>Blacklisted</Badge>}
          </div>
          <p className="mt-1 text-sm text-ink-500">
            {d.owner.name} · {d.owner.city} · <span className="break-all">{d.owner.email}</span> · created {date(d.createdAt)}
            {d.occasion && ` · ${d.occasion}`}
            {d.eventDate && ` on ${date(d.eventDate)}`}
          </p>
          {d.description && <p className="mt-2 max-w-2xl text-sm text-ink-700">{d.description}</p>}
        </div>
        {d.canManage && (
          <div className="flex flex-wrap gap-2">
            {d.closed ? (
              <Button variant="secondary" icon={LockOpen} onClick={() => setActing({ key: "reopen" })}>Reopen wishlist</Button>
            ) : (
              <Button variant="secondary" icon={Lock} onClick={() => setActing({ key: "close" })}>Close wishlist</Button>
            )}
            {d.blacklist?.list ? (
              <Button variant="secondary" icon={ShieldCheck} onClick={() => setActing({ key: "unblacklist" })}>Lift blacklist</Button>
            ) : (
              <Button variant="danger" icon={Ban} onClick={() => setActing({ key: "blacklist" })}>Blacklist</Button>
            )}
          </div>
        )}
      </header>

      {d.blacklist && (
        <Notice className="mb-6" tone="danger" icon={Ban} title={d.blacklist.list ? `Wishlist blacklisted ${dateTime(d.blacklist.at)}${d.blacklist.by ? ` by ${d.blacklist.by}` : ""}` : "The owner's account is blacklisted"}>
          {d.blacklist.reason} Nobody can gift from this list, it&apos;s hidden from discovery, and payments already started are refused.
          {!d.blacklist.list && " Lift it from Customers."}
        </Notice>
      )}

      {d.closed &&
        (d.closed.byOwner ? (
          <Notice className="mb-6" tone={d.closed.kind === "Thanks" ? "success" : "info"} icon={Heart} title={`Closed by the owner ${dateTime(d.closed.at)} · ${closureLabel[d.closed.kind]}`}>
            {d.closed.note && <span className="block font-display text-base italic">“{d.closed.note}”</span>}
            <span className="mt-1 block text-xs">
              {d.closed.notePublic ? "Their message is shown on the public wishlist." : "They kept their message off the public wishlist."}
              {d.closed.kind === "Thanks" && " Everyone who gifted was sent it."} Nobody can gift from the list any more; only VeilWish (SecretWish) can reopen it.
            </span>
          </Notice>
        ) : (
          <Notice className="mb-6" tone="info" title={`Closed ${dateTime(d.closed.at)} by ${d.closed.by}`}>
            {d.closed.reason} Senders can still see the list but can&apos;t gift from it.
          </Notice>
        ))}
      {!d.closed && d.state === "Fulfilled" && (
        <Notice className="mb-6" tone="success" title="Every wish has been gifted">
          Senders can still give from it. Close it if no more gifts should come in.
        </Notice>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard tint="plum" label="Wishes gifted" value={`${d.stats.fulfilled} / ${d.stats.items}`} />
        <KpiCard tint="gold" label="Gifts" value={d.stats.gifts.toLocaleString()} hint="Paid orders and cash gifts" />
        <KpiCard tint="sage" label="Gifters" value={d.stats.gifters.toLocaleString()} hint="Different senders" />
        <KpiCard tint="lavender" label="Given" value={fmt(d.stats.givenUsd)} />
        <KpiCard tint="plum" label="Gift orders" value={d.stats.orders.toLocaleString()} hint={`${fmt(d.stats.ordersUsd)} · ${d.stats.deliveredOrders} delivered`} />
        <KpiCard tint="gold" label="Cash gifts" value={d.stats.cash.toLocaleString()} hint={`${fmt(d.stats.cashUsd)} · ${d.stats.cashReceived} confirmed received`} />
        <KpiCard tint="sage" label="Sourcing requests" value={d.stats.requests.toLocaleString()} hint="Vendors asked to find a custom wish" />
        <KpiCard tint="lavender" label="Didn't go through" value={d.stats.unsuccessful.toLocaleString()} hint="Unpaid, cancelled or refunded" />
      </div>

      {/* Wishes get the full width, laid out as rows that wrap rather than a table, so everything shows at a glance without scrolling. */}
      <Card>
        <CardHeader title={`Wishes (${d.items.length})`} description="In the owner's order, with how many times each was gifted." />
        {d.items.length === 0 ? (
          <p className="p-5 text-sm text-ink-500">No wishes yet.</p>
        ) : (
          <div className="@container">
            <div aria-hidden className="hidden border-b border-ink-100 px-5 pb-2 text-xs font-medium text-ink-500 @3xl:grid @3xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,2fr)] @3xl:gap-6">
              {itemCols.map((c) => <span key={c.key} className={cx(c.align === "right" && "text-right")}>{c.header}</span>)}
            </div>
            <ul className="divide-y divide-ink-100">
              {d.items.map((i) => (
                <li key={i.id} className="grid gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-2 @3xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,2fr)] @3xl:items-start">
                  {itemCols.map((c) => (
                    <div key={c.key} className={cx("min-w-0 text-sm", c.key === "n" && "sm:col-span-2 @3xl:col-span-1", c.align === "right" && "@3xl:text-right")}>
                      {c.key !== "n" && <p className="mb-1 text-[11px] font-medium text-ink-400 @3xl:hidden">{c.header}</p>}
                      {c.render(i)}
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
      <Card className="mt-6">
        <CardHeader title={`Gifts (${d.gifts.length})`} description="Every paid gift from this list, newest first. Refunded and cancelled ones aren't counted." />
        <DataTable caption="Gifts" columns={giftCols} rows={d.gifts} rowKey={(g) => g.id} empty={<p className="p-5 text-sm text-ink-500">Nobody has gifted from this list yet.</p>} />
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader title="Campaign timeline" description="Everything that happened on this list, oldest first." />
          <ol className="space-y-3 p-5 text-sm">
            {timeline.map((e, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-gold-500" aria-hidden />
                <span><b>{e.title}</b><br /><span className="text-xs text-ink-500">{e.detail} · {dateTime(e.at)}</span></span>
              </li>
            ))}
          </ol>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title={`Gifters (${d.gifters.length})`} description="Who gave, most given first." />
            <DataTable caption="Gifters" columns={gifterCols} rows={d.gifters} rowKey={(g) => g.sender + g.last} empty={<p className="p-5 text-sm text-ink-500">No gifters yet.</p>} />
          </Card>
          <Card>
            <CardHeader title={`Sourcing requests (${d.requests.length})`} description="Senders asking vendors to find a custom wish from this list." />
            <DataTable caption="Sourcing requests" columns={requestCols} rows={d.requests} rowKey={(r) => r.id} empty={<p className="p-5 text-sm text-ink-500">No sourcing requests.</p>} />
          </Card>
          {d.unsuccessful.length > 0 && (
            <Card>
              <CardHeader title={`Didn't go through (${d.unsuccessful.length})`} description="Started from this list but never completed. Not counted as gifts." />
              <DataTable caption="Gifts that didn't go through" columns={giftCols} rows={d.unsuccessful} rowKey={(g) => g.id} />
            </Card>
          )}
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader title="Details" />
        <dl className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
          <Stat label="Currency" value={d.currency} />
          <Stat label="Visibility" value={d.visibility} />
          <Stat label="Event" value={d.eventDate ? date(d.eventDate) : "—"} />
          <Stat label="Created" value={date(d.createdAt)} />
        </dl>
      </Card>

      <ConfirmDialog
        open={!!acting}
        onClose={() => { setActing(null); act.setError(null); }}
        title={acting ? dialog[acting.key].title(acting.item?.name) : ""}
        description={acting?.key === "reopen" && d.closed?.byOwner ? "The owner closed this list themselves. Reopening lets senders gift from it again and removes their closing message. The owner is notified." : acting ? dialog[acting.key].description : undefined}
        confirmLabel={acting ? dialog[acting.key].confirm : ""}
        tone={acting && dialog[acting.key].danger ? "danger" : "primary"}
        reasonLabel={acting ? dialog[acting.key].reason : undefined}
        pending={act.pending}
        error={act.error?.message}
        onConfirm={async (reason) => {
          if (acting && (await act.run(acting.key, reason, acting.item?.id)) !== undefined) {
            toast({ tone: "success", title: dialog[acting.key].done });
            setActing(null);
            reload();
          }
        }}
      />
    </>
  );
}
