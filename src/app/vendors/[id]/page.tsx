"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, BadgeCheck, CircleX } from "lucide-react";
import { api, useApi, useMutation } from "@/shared/lib/api";
import { useSession } from "@/shared/lib/session";
import { useAccess } from "@/lib/access";
import { date, dateTime, pct } from "@/shared/lib/format";
import { Avatar, Button, Card, CardHeader, ErrorState, KpiCard, Notice, PageSkeleton, ProductArt, StatusBadge } from "@/shared/ui/primitives";
import { ConfirmDialog, useToast } from "@/shared/ui/overlay";

type Detail = {
  vendor: { id: string; name: string; contactName: string; email: string; city: string; primaryCategory: string; description: string; status: string; businessVerified: boolean; bankVerified: boolean; idVerified: boolean; rating: number; acceptanceRate: number; avgFulfilmentHours: number; onTimeRate: number; plan: string; decisionReason?: string; appliedAt: string };
  products: { id: string; name: string; emoji: string; tint: string; priceUsd: number; status: string; stock: number; reviewNote?: string }[];
  stats: { orders: number; gmv: number; delivered: number; exceptions: number; refunds: number };
  recentOrders: { id: string; reference: string; createdAt: string; status: string; total: number; product: string }[];
  payouts: { id: string; reference: string; net: number; status: string; createdAt: string; reconciliation: string }[];
  decisions: { id: string; at: string; actor: string; action: string; reason: string }[];
};

const decisionCopy: Record<string, { label: string; tone: "primary" | "danger" | "gold"; reason: string }> = {
  approve: { label: "Approve vendor", tone: "primary", reason: "Why are you approving this vendor?" },
  reject: { label: "Reject application", tone: "danger", reason: "Reason shared with the applicant" },
  suspend: { label: "Suspend vendor", tone: "danger", reason: "Reason for suspension" },
  reinstate: { label: "Reinstate vendor", tone: "gold", reason: "Why is it safe to reinstate?" },
};

export default function VendorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading, reload } = useApi<Detail>(`/admin/vendors/${id}`);
  const { fmt } = useSession();
  const { can } = useAccess();
  const toast = useToast();
  const [decision, setDecision] = useState<string | null>(null);
  const decide = useMutation((d: string, reason: string) => api(`/admin/vendors/${id}/decision`, { method: "POST", body: { decision: d, reason } }));

  if (loading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;
  const v = data.vendor;
  const available = v.status === "Pending" ? ["approve", "reject"] : v.status === "Approved" ? ["suspend"] : v.status === "Suspended" ? ["reinstate"] : ["approve"];
  const canDecide = can("vendors.manage");

  return (
    <>
      <Link href="/vendors" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-plum-700">
        <ArrowLeft className="size-4" aria-hidden /> Vendors
      </Link>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={v.name} size={56} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-3xl font-semibold text-plum-900">{v.name}</h1>
              <StatusBadge status={v.status} />
            </div>
            <p className="text-sm text-ink-500">
              {v.primaryCategory} · {v.city} · {v.contactName} · {v.plan} · applied {date(v.appliedAt)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {available.map((a) => (
            <Button key={a} variant={decisionCopy[a].tone === "danger" ? "secondary" : "primary"} disabled={!canDecide} onClick={() => setDecision(a)}>
              {decisionCopy[a].label}
            </Button>
          ))}
        </div>
      </header>
      {!canDecide && <Notice className="mb-6">Only operations admins can change vendor status. You have read-only access.</Notice>}
      {v.decisionReason && (
        <Notice className="mb-6" tone={v.status === "Approved" ? "success" : "warning"} title="Latest decision reason">
          {v.decisionReason}
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard tint="plum" label="Orders" value={data.stats.orders} />
        <KpiCard tint="gold" label="GMV" value={fmt(data.stats.gmv)} />
        <KpiCard tint="sage" label="Acceptance rate" value={pct(v.acceptanceRate * 100, 0)} />
        <KpiCard tint="lavender" label="On-time delivery" value={pct(v.onTimeRate * 100, 0)} hint={`${v.avgFulfilmentHours}h avg. fulfilment`} />
        <KpiCard tint="rose" label="Exceptions / refunds" value={`${data.stats.exceptions} / ${data.stats.refunds}`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader title="Verification" description="Know-your-business checks (simulated)" />
          <ul className="space-y-2 p-5 text-sm">
            {[
              ["Business registration (CAC)", v.businessVerified],
              ["Settlement bank account", v.bankVerified],
              ["Director ID", v.idVerified],
            ].map(([label, ok]) => (
              <li key={label as string} className="flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2">
                <span>{label}</span>
                <span className={ok ? "inline-flex items-center gap-1 font-semibold text-success-700" : "inline-flex items-center gap-1 font-semibold text-ink-500"}>
                  {ok ? <BadgeCheck className="size-4" aria-hidden /> : <CircleX className="size-4" aria-hidden />} {ok ? "Verified" : "Not verified"}
                </span>
              </li>
            ))}
          </ul>
          <p className="px-5 pb-5 text-[13px] text-ink-700">{v.description}</p>
        </Card>
        <Card>
          <CardHeader title="Listings" description="Review quality before products go live" action={<Link href="/products" className="text-xs font-semibold text-plum-700 hover:underline">Review queue</Link>} />
          <ul className="grid gap-2 p-4 sm:grid-cols-2">
            {data.products.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border border-ink-100 p-2.5">
                <ProductArt emoji={p.emoji} tint={p.tint} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{p.name}</p>
                  <p className="text-xs text-ink-500">
                    {fmt(p.priceUsd)} · {p.stock} in stock
                  </p>
                </div>
                <StatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Recent orders" />
          <ul className="divide-y divide-ink-100 px-5 pb-3">
            {data.recentOrders.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-2.5 text-[13px]">
                <Link href={`/orders/${o.id}`} className="font-semibold hover:text-plum-700">
                  {o.reference}
                  <span className="block text-xs font-normal text-ink-500">{o.product}</span>
                </Link>
                <StatusBadge status={o.status} />
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Payout history" />
          <ul className="divide-y divide-ink-100 px-5 pb-3">
            {data.payouts.length === 0 && <li className="py-6 text-sm text-ink-500">No payouts yet.</li>}
            {data.payouts.slice(0, 8).map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2.5 text-[13px]">
                <span>
                  <b>{p.reference}</b>
                  <span className="block text-xs text-ink-500">{date(p.createdAt)}</span>
                </span>
                <span className="text-right">
                  <span className="block font-semibold tabular">{fmt(p.net)}</span>
                  <StatusBadge status={p.status} />
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Decision history" description="From the audit log" />
          <ol className="space-y-3 px-5 pb-5">
            {data.decisions.length === 0 && <li className="text-sm text-ink-500">No decisions recorded.</li>}
            {data.decisions.map((a) => (
              <li key={a.id} className="text-[13px]">
                <p className="font-semibold">{a.action}</p>
                <p className="text-ink-700">{a.reason}</p>
                <p className="text-[11px] text-ink-400">
                  {a.actor} · {dateTime(a.at)}
                </p>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <ConfirmDialog
        open={!!decision}
        onClose={() => setDecision(null)}
        title={decision ? decisionCopy[decision].label : ""}
        tone={decision && decisionCopy[decision].tone === "danger" ? "danger" : "primary"}
        description={decision === "suspend" ? "Suspension hides all listings and blocks payouts until reinstated." : undefined}
        reasonLabel={decision ? decisionCopy[decision].reason : undefined}
        confirmLabel={decision ? decisionCopy[decision].label : "Confirm"}
        pending={decide.pending}
        error={decide.error?.message}
        onConfirm={async (reason) => {
          if (decision && (await decide.run(decision, reason)) !== undefined) {
            toast({ tone: "success", title: `${v.name}: ${decisionCopy[decision].label.toLowerCase()} — done`, body: "The vendor has been notified." });
            setDecision(null);
          }
        }}
      />
    </>
  );
}
