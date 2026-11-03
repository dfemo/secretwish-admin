"use client";

import Link from "next/link";
import { useState } from "react";
import { MapPin, PackageCheck, Phone, Warehouse } from "lucide-react";
import { api, useApi, useMutation } from "@/shared/lib/api";
import { date, dateTime } from "@/shared/lib/format";
import { Badge, Button, Card, EmptyState, ErrorState, Notice, PageHeader, PageSkeleton, SearchInput, StatusBadge, Tabs } from "@/shared/ui/primitives";
import { useToast } from "@/shared/ui/overlay";
import { OrderActionDialog, type OrderAction } from "@/shared/ui/order-actions";

type Stage = "inbound" | "at-hub" | "ready" | "delivered";
type HubOrder = {
  id: string; reference: string; status: string; deliveryDate: string | null; deliveryOption: string; courier: string | null; trackingReference: string | null;
  hubReceivedAt: string | null; hubReceivedBy: string | null; hubReadyAt: string | null; deliveredAt: string | null;
  vendor: string | null; product: { productName: string; emoji: string; quantity: number } | null; actions: OrderAction[];
};
type Group = {
  key: string;
  recipient: { name: string; phone: string | null; address: string | null; city: string };
  waiting: { inbound: number; atHub: number; ready: number };
  dueBy: string | null;
  orders: HubOrder[];
};
type HubData = { groups: Group[]; counts: Record<Stage, number>; hub: { name: string; address: string; city: string; phone: string }; canManage: boolean; truncated: boolean };

const stageCopy: Record<Stage, string> = {
  inbound: "Paid gifts that vendors are preparing or bringing to the hub.",
  "at-hub": "Received from vendors. Mark them ready once everything for that person is in and packed.",
  ready: "Packed and going out with SecretWish. Confirm delivery with evidence once handed over.",
  delivered: "Delivered by SecretWish in the last 30 days.",
};

/** The SecretWish hub: gifts vendors deliver to SecretWish, grouped by the person they're for, from arrival to delivery. */
export default function HubPage() {
  const [stage, setStage] = useState<Stage>("inbound");
  const [search, setSearch] = useState("");
  const { data, error, loading, reload } = useApi<HubData>(`/admin/hub?stage=${stage}&search=${encodeURIComponent(search)}`);
  const [action, setAction] = useState<{ order: HubOrder; action: OrderAction } | null>(null);
  const toast = useToast();
  // Marks every one of a person's gifts that's at the hub as ready, one after another.
  const readyAll = useMutation(async (orders: HubOrder[]) => {
    for (const o of orders) await api(`/admin/orders/${o.id}/actions/hub-ready`, { method: "POST", body: {} });
    return orders.length;
  });

  return (
    <>
      <PageHeader
        title="SecretWish Hub"
        description="Gifts that vendors deliver to SecretWish, so we can check them, pack a person's gifts together and deliver them ourselves."
      />
      {data && (
        <Card className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
          <span className="inline-flex items-center gap-2 font-semibold text-plum-900"><Warehouse className="size-4" aria-hidden /> {data.hub.name}</span>
          {data.hub.address ? (
            <span className="inline-flex items-center gap-1.5 text-ink-700"><MapPin className="size-4" aria-hidden /> {data.hub.address}, {data.hub.city}</span>
          ) : (
            <span className="text-warning-700">No hub address yet: vendors won&apos;t know where to deliver. <Link href="/settings" className="font-semibold underline">Add it in Settings</Link>.</span>
          )}
          {data.hub.phone && <span className="inline-flex items-center gap-1.5 text-ink-700"><Phone className="size-4" aria-hidden /> {data.hub.phone}</span>}
        </Card>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={stage}
          onChange={setStage}
          tabs={[
            { value: "inbound", label: "Coming in", count: data?.counts.inbound },
            { value: "at-hub", label: "At hub", count: data?.counts["at-hub"] },
            { value: "ready", label: "Out for delivery", count: data?.counts.ready },
            { value: "delivered", label: "Delivered", count: data?.counts.delivered },
          ]}
        />
        <SearchInput value={search} onChange={setSearch} label="Search the hub" placeholder="Order reference, city or name" className="w-72" />
      </div>
      <p className="mb-5 text-sm text-ink-500">{stageCopy[stage]}</p>

      {loading && !data ? (
        <PageSkeleton />
      ) : error || !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data.groups.length === 0 ? (
        <EmptyState icon={Warehouse} title="Nothing here" description="Hub orders appear here when senders or recipients choose SecretWish delivery, or a wishlist's gifts come from several vendors." />
      ) : (
        <ul className="space-y-4">
          {data.groups.map((g) => {
            const total = g.waiting.inbound + g.waiting.atHub + g.waiting.ready;
            const atHub = g.orders.filter((o) => o.status === "AtHub");
            return (
              <li key={g.key}>
                <Card className="overflow-hidden">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 bg-ivory-100/60 px-5 py-3">
                    <div>
                      <p className="font-semibold text-plum-900">For {g.recipient.name} · {g.recipient.city}</p>
                      <p className="text-xs text-ink-500">
                        {g.recipient.address ?? "Address hidden for your role"}
                        {g.recipient.phone && ` · ${g.recipient.phone}`}
                        {g.dueBy && ` · due by ${date(g.dueBy)}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {stage !== "delivered" && total > 1 && (
                        <Badge tone={g.waiting.inbound > 0 ? "warning" : "success"}>
                          {g.waiting.atHub + g.waiting.ready} of {total} gifts in{g.waiting.inbound > 0 ? ` · ${g.waiting.inbound} still coming` : " · all here"}
                        </Badge>
                      )}
                      {stage === "at-hub" && data.canManage && atHub.length > 1 && (
                        <Button
                          size="sm"
                          icon={PackageCheck}
                          disabled={g.waiting.inbound > 0}
                          loading={readyAll.pending}
                          onClick={async () => {
                            const n = await readyAll.run(atHub);
                            if (n) { toast({ tone: "success", title: `${n} gifts ready for delivery` }); reload(); }
                          }}
                        >
                          Mark all {atHub.length} ready
                        </Button>
                      )}
                    </div>
                  </div>
                  <ul className="divide-y divide-ink-100">
                    {g.orders.map((o) => (
                      <li key={o.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                        <span className="text-2xl" aria-hidden>{o.product?.emoji ?? "🎁"}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">
                            <Link href={`/orders/${o.id}`} className="text-plum-700 hover:underline">{o.reference}</Link> · {o.product?.productName}
                            {(o.product?.quantity ?? 1) > 1 && ` ×${o.product!.quantity}`}
                          </p>
                          <p className="text-xs text-ink-500">
                            from {o.vendor}
                            {o.courier && o.status !== "ReadyForDelivery" && ` · ${o.courier}${o.trackingReference ? ` ${o.trackingReference}` : ""}`}
                            {o.hubReceivedAt && ` · received ${dateTime(o.hubReceivedAt)}${o.hubReceivedBy ? ` by ${o.hubReceivedBy}` : ""}`}
                            {o.deliveredAt && ` · delivered ${dateTime(o.deliveredAt)}`}
                          </p>
                        </div>
                        <StatusBadge status={o.status} />
                        {data.canManage &&
                          o.actions
                            .filter((a) => ["hub-receive", "hub-ready", "confirm-delivery", "report-issue"].includes(a.key))
                            .map((a) => (
                              <Button key={a.key} size="sm" variant={a.key === "report-issue" ? "ghost" : a.key === "confirm-delivery" ? "primary" : "secondary"} onClick={() => setAction({ order: o, action: a })}>
                                {a.key === "confirm-delivery" ? "Mark delivered" : a.label}
                              </Button>
                            ))}
                      </li>
                    ))}
                  </ul>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      {data?.truncated && <Notice className="mt-4" tone="info">Showing the first 300 orders at this stage. Search to narrow it down.</Notice>}
      {readyAll.error && <Notice className="mt-4" tone="danger">{readyAll.error.message}</Notice>}
      <OrderActionDialog action={action?.action ?? null} basePath="/admin" orderId={action?.order.id ?? ""} onClose={() => { setAction(null); reload(); }} />
    </>
  );
}
