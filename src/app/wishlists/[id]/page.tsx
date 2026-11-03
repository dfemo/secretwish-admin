"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Lock, LockOpen, Users } from "lucide-react";
import { api, useApi, useMutation } from "@/shared/lib/api";
import { useSession } from "@/shared/lib/session";
import { date, dateTime } from "@/shared/lib/format";
import { Badge, Button, Card, CardHeader, ErrorState, KpiCard, Notice, PageSkeleton, Stat, StatusBadge } from "@/shared/ui/primitives";
import { DataTable, type Column } from "@/shared/ui/data";
import { ConfirmDialog, useToast } from "@/shared/ui/overlay";

type Item = { id: string; kind: string; name: string; quantity: number; fulfilled: boolean; notes: string; priceUsd: number | null; giftCount: number; label: string | null };
type Gift = { id: string; kind: "Order" | "Cash"; reference: string; amountUsd: number; at: string; status: string; sender: string; item: string | null };
type Detail = {
  id: string; title: string; description: string; occasion: string | null; eventDate: string | null; visibility: string; currency: string; createdAt: string;
  owner: { id: string; name: string; email: string; city: string };
  state: "Open" | "Fulfilled" | "Closed";
  closed: { at: string; by: string; reason: string } | null;
  stats: { items: number; fulfilled: number; gifts: number; gifters: number; givenUsd: number };
  items: Item[];
  gifts: Gift[];
  canManage: boolean;
};

export default function WishlistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: d, error, loading, reload } = useApi<Detail>(`/admin/wishlists/${id}`);
  const { fmt } = useSession();
  const toast = useToast();
  const [acting, setActing] = useState<"close" | "reopen" | null>(null);
  const act = useMutation((key: string, reason: string) => api(`/admin/wishlists/${id}/${key}`, { method: "POST", body: { body: reason } }));

  if (loading) return <PageSkeleton />;
  if (error || !d) return <ErrorState error={error} onRetry={reload} />;

  const itemCols: Column<Item>[] = [
    { key: "n", header: "Wish", render: (i) => (<div><p className="font-semibold">{i.name}</p><p className="text-xs text-ink-500">{i.kind}{i.quantity > 1 ? ` · ×${i.quantity}` : ""}{i.notes ? ` · ${i.notes}` : ""}</p></div>) },
    { key: "p", header: "Price", align: "right", render: (i) => (i.priceUsd != null ? fmt(i.priceUsd) : "—") },
    { key: "g", header: "Gifted", render: (i) => (i.label ? <Badge tone={i.giftCount > 1 ? "plum" : "success"}>{i.label}</Badge> : i.fulfilled ? <Badge tone="success">Gifted</Badge> : <span className="text-xs text-ink-400">Not yet</span>) },
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
          </div>
          <p className="mt-1 text-sm text-ink-500">
            {d.owner.name} · {d.owner.city} · <span className="break-all">{d.owner.email}</span> · created {date(d.createdAt)}
            {d.occasion && ` · ${d.occasion}`}
            {d.eventDate && ` on ${date(d.eventDate)}`}
          </p>
          {d.description && <p className="mt-2 max-w-2xl text-sm text-ink-700">{d.description}</p>}
        </div>
        {d.canManage &&
          (d.closed ? (
            <Button variant="secondary" icon={LockOpen} onClick={() => setActing("reopen")}>Reopen wishlist</Button>
          ) : (
            <Button variant="secondary" icon={Lock} onClick={() => setActing("close")}>Close wishlist</Button>
          ))}
      </header>

      {d.closed && (
        <Notice className="mb-6" tone="info" title={`Closed ${dateTime(d.closed.at)} by ${d.closed.by}`}>
          {d.closed.reason} Senders can still see the list but can&apos;t gift from it.
        </Notice>
      )}
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
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader title={`Wishes (${d.items.length})`} description="In the owner's order, with how many times each was gifted." />
          <DataTable caption="Wishes" columns={itemCols} rows={d.items} rowKey={(i) => i.id} empty={<p className="p-5 text-sm text-ink-500">No wishes yet.</p>} />
        </Card>
        <Card>
          <CardHeader title={`Gifts (${d.gifts.length})`} description="Every paid gift from this list, newest first. Refunded and cancelled ones aren't counted." />
          <DataTable caption="Gifts" columns={giftCols} rows={d.gifts} rowKey={(g) => g.id} empty={<p className="p-5 text-sm text-ink-500">Nobody has gifted from this list yet.</p>} />
        </Card>
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
        title={acting === "close" ? "Close this wishlist?" : "Reopen this wishlist?"}
        description={acting === "close" ? "No more senders will be able to gift from it. The owner is notified and this is recorded in the audit log." : "Senders will be able to gift from it again. The owner is notified."}
        confirmLabel={acting === "close" ? "Close wishlist" : "Reopen wishlist"}
        tone={acting === "close" ? "danger" : "primary"}
        reasonLabel={acting === "close" ? "Why are you closing it?" : undefined}
        pending={act.pending}
        error={act.error?.message}
        onConfirm={async (reason) => {
          if (acting && (await act.run(acting, reason)) !== undefined) {
            toast({ tone: "success", title: acting === "close" ? "Wishlist closed" : "Wishlist reopened" });
            setActing(null);
            reload();
          }
        }}
      />
    </>
  );
}
