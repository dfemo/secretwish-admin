"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, HandCoins, Play } from "lucide-react";
import { api, useApi, useMutation } from "@/shared/lib/api";
import { useSession } from "@/shared/lib/session";
import { useAccess } from "@/lib/access";
import { date } from "@/shared/lib/format";
import { Badge, Button, Card, CardHeader, cx, EmptyState, ErrorState, KpiCard, Notice, PageHeader, PageSkeleton, StatusBadge, Tabs } from "@/shared/ui/primitives";
import { ConfirmDialog, useToast } from "@/shared/ui/overlay";
import { DataTable, type Column } from "@/shared/ui/data";

type Pipeline = {
  vendor: { id: string; name: string; status: string };
  eligibleOrders: number; gross: number; fees: number; net: number;
  blocked: { reason: string; count: number; amount: number }[];
  orders: { id: string; reference: string; status: string; deliveredAt?: string; deliveryEvidence?: string; senderApprovedAt?: string | null; net: number; eligible: boolean; reason: string }[];
};
type Payout = { id: string; reference: string; vendor: string; vendorId: string; orderReferences: string[]; gross: number; fees: number; adjustments: number; deductions: number; net: number; status: string; providerStatus: string; providerReference?: string; reconciliation: string; createdAt: string; paidAt?: string };
type Data = { rules: { payoutHoldDays: number; requireDeliveryEvidenceForPayout: boolean; commissionRate: number }; pipeline: Pipeline[]; payouts: Payout[] };

export default function PayoutsPage() {
  const { data, error, loading, reload } = useApi<Data>("/admin/payouts");
  const { fmt } = useSession();
  const { can } = useAccess();
  const toast = useToast();
  const [tab, setTab] = useState<"pipeline" | "history">("pipeline");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [runFor, setRunFor] = useState<Pipeline | null>(null);
  const [resolve, setResolve] = useState<Payout | null>(null);
  const run = useMutation((vendorId: string) => api<{ reference: string; net: number; orders: number }>("/admin/payouts/run", { method: "POST", body: { vendorId } }));
  const callback = useMutation((id: string, status: string) => api(`/admin/payouts/${id}/provider-callback`, { method: "POST", body: { status } }));
  const reconcile = useMutation((id: string, body: string) => api(`/admin/payouts/${id}/reconcile`, { method: "POST", body: { body } }));
  const canAct = can("payouts.manage");

  if (loading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;
  const eligibleNet = data.pipeline.reduce((s, p) => s + p.net, 0);
  const blockedNet = data.pipeline.reduce((s, p) => s + p.blocked.reduce((a, b) => a + b.amount, 0), 0);
  const processing = data.payouts.filter((p) => p.status === "Processing");
  const exceptions = data.payouts.filter((p) => p.reconciliation === "Exception");

  const historyCols: Column<Payout>[] = [
    { key: "ref", header: "Payout", render: (p) => (<div><p className="font-semibold">{p.reference}</p><p className="text-xs text-ink-500">{p.vendor}</p></div>) },
    { key: "orders", header: "Orders", hideOnMobile: true, render: (p) => <span className="text-xs" title={p.orderReferences.join(", ")}>{p.orderReferences.length} orders</span> },
    { key: "gross", header: "Gross", align: "right", render: (p) => fmt(p.gross) },
    { key: "fees", header: "Fees", align: "right", hideOnMobile: true, render: (p) => <span className="text-ink-500">−{fmt(p.fees)}</span> },
    { key: "ded", header: "Deductions", align: "right", hideOnMobile: true, render: (p) => (p.deductions ? `−${fmt(p.deductions)}` : "—") },
    { key: "net", header: "Net", align: "right", render: (p) => <b>{fmt(p.net)}</b> },
    { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
    { key: "provider", header: "Provider", hideOnMobile: true, render: (p) => (<div className="max-w-[220px]"><p className="truncate text-xs">{p.providerStatus}</p>{p.providerReference && <p className="font-mono text-[10px] text-ink-400">{p.providerReference}</p>}</div>) },
    { key: "rec", header: "Reconciliation", render: (p) => <StatusBadge status={p.reconciliation} /> },
    { key: "date", header: "Created", hideOnMobile: true, render: (p) => <span className="text-xs">{date(p.createdAt)}</span> },
    {
      key: "act",
      header: <span className="sr-only">Actions</span>,
      render: (p) =>
        canAct && p.status === "Processing" ? (
          <div className="flex gap-1">
            <Button size="sm" variant="subtle" onClick={async () => { if ((await callback.run(p.id, "success")) !== undefined) toast({ tone: "success", title: `${p.reference} confirmed by provider (simulated)` }); }}>Simulate success</Button>
            <Button size="sm" variant="ghost" onClick={async () => { if ((await callback.run(p.id, "failure")) !== undefined) toast({ tone: "error", title: `${p.reference} failed (simulated)`, body: "Orders returned to the pipeline." }); }}>Fail</Button>
          </div>
        ) : canAct && p.reconciliation === "Exception" ? (
          <Button size="sm" variant="secondary" onClick={() => setResolve(p)}>Resolve</Button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader title="Vendor Payouts" description="Payouts are calculated from eligible orders and executed by the payment provider — SecretWish never holds funds in this design." />
      <Notice className="mb-6" tone="info" title="Eligibility rules (configurable in Settings)">
        Delivered with evidence{data.rules.requireDeliveryEvidenceForPayout ? " (required)" : ""} · {data.rules.payoutHoldDays}-day hold after delivery · no open refund, dispute or chargeback · no fraud hold · vendor not suspended · payment settled. Commission {Math.round(data.rules.commissionRate * 100)}%. Provider calls are simulated.
      </Notice>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard tint="sage" icon={HandCoins} label="Eligible now (net)" value={fmt(eligibleNet)} hint={`${data.pipeline.filter((p) => p.eligibleOrders > 0).length} vendors`} />
        <KpiCard tint="gold" label="Blocked / pending" value={fmt(blockedNet)} hint="Hold period, cases, evidence…" />
        <KpiCard tint="lavender" label="With provider" value={processing.length} hint={fmt(processing.reduce((s, p) => s + p.net, 0))} />
        <KpiCard tint="rose" label="Reconciliation exceptions" value={exceptions.length} />
      </div>
      <Card>
        <div className="border-b border-ink-100 p-4">
          <Tabs value={tab} onChange={setTab} tabs={[{ value: "pipeline", label: "Payout pipeline" }, { value: "history", label: "Payout history", count: data.payouts.length }]} />
        </div>
        {tab === "pipeline" ? (
          <ul className="divide-y divide-ink-100">
            {data.pipeline.map((p) => (
              <li key={p.vendor.id}>
                <div className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <button type="button" onClick={() => setExpanded(expanded === p.vendor.id ? null : p.vendor.id)} aria-expanded={expanded === p.vendor.id} className="flex min-w-[200px] flex-1 items-center gap-2 text-left">
                    <ChevronDown className={cx("size-4 text-ink-400 transition-transform", expanded === p.vendor.id && "rotate-180")} aria-hidden />
                    <span>
                      <span className="font-semibold">{p.vendor.name}</span> {p.vendor.status === "Suspended" && <Badge tone="danger">Suspended</Badge>}
                      <span className="block text-xs text-ink-500">{p.blocked.map((b) => `${b.count} ${b.reason.toLowerCase()}`).join(" · ") || "Nothing blocked"}</span>
                    </span>
                  </button>
                  <dl className="flex gap-6 text-right text-[13px]">
                    <div><dt className="text-[11px] text-ink-500">Eligible orders</dt><dd className="font-semibold tabular">{p.eligibleOrders}</dd></div>
                    <div><dt className="text-[11px] text-ink-500">Gross</dt><dd className="tabular">{fmt(p.gross)}</dd></div>
                    <div><dt className="text-[11px] text-ink-500">Fees</dt><dd className="tabular text-ink-500">−{fmt(p.fees)}</dd></div>
                    <div><dt className="text-[11px] text-ink-500">Net payable</dt><dd className="font-semibold tabular">{fmt(p.net)}</dd></div>
                  </dl>
                  <Button size="sm" icon={Play} disabled={!canAct || p.eligibleOrders === 0} onClick={() => setRunFor(p)}>
                    Initiate payout
                  </Button>
                </div>
                {expanded === p.vendor.id && (
                  <div className="overflow-x-auto bg-ivory-100/60 px-5 pb-4">
                    <table className="w-full min-w-[560px] text-left text-[13px]">
                      <caption className="sr-only">Orders in {p.vendor.name}&apos;s pipeline</caption>
                      <thead><tr className="text-xs text-ink-500"><th className="py-2 font-semibold">Order</th><th className="py-2 font-semibold">Status</th><th className="py-2 font-semibold">Delivered</th><th className="py-2 font-semibold">Evidence</th><th className="py-2 text-right font-semibold">Net</th><th className="py-2 pl-4 font-semibold">Eligibility</th></tr></thead>
                      <tbody>
                        {p.orders.map((o) => (
                          <tr key={o.id} className="border-t border-ink-200/60">
                            <td className="py-2"><Link href={`/orders/${o.id}`} className="font-semibold text-plum-700 hover:underline">{o.reference}</Link></td>
                            <td className="py-2"><StatusBadge status={o.status} /></td>
                            <td className="py-2 text-xs">{date(o.deliveredAt)}{o.senderApprovedAt && <span className="block font-semibold text-success-700">Sender confirmed {date(o.senderApprovedAt)}</span>}</td>
                            <td className="max-w-[200px] truncate py-2 text-xs">{o.deliveryEvidence ?? "—"}</td>
                            <td className="py-2 text-right tabular">{fmt(o.net)}</td>
                            <td className="py-2 pl-4">{o.eligible ? <StatusBadge status="Eligible" /> : <span className="text-xs text-ink-500">{o.reason}</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <DataTable caption="Payout history" columns={historyCols} rows={data.payouts} rowKey={(p) => p.id} empty={<EmptyState icon={HandCoins} title="No payouts yet" />} />
        )}
      </Card>
      {!canAct && <p className="mt-3 text-xs text-ink-500">Read-only: payouts are initiated by Finance.</p>}

      <ConfirmDialog
        open={!!runFor}
        onClose={() => setRunFor(null)}
        title={`Initiate payout to ${runFor?.vendor.name}`}
        tone="gold"
        confirmLabel={`Initiate ${runFor ? fmt(runFor.net) : ""}`}
        pending={run.pending}
        error={run.error?.message}
        description={
          runFor && (
            <div className="space-y-2">
              <p>{runFor.eligibleOrders} eligible orders will be batched and submitted to the payment provider&apos;s transfer API (simulated). Eligibility is re-checked on the server at submission time.</p>
              <dl className="rounded-xl bg-ivory-100 p-3 text-[13px]">
                <div className="flex justify-between"><dt>Gross</dt><dd className="tabular">{fmt(runFor.gross)}</dd></div>
                <div className="flex justify-between"><dt>SecretWish fees</dt><dd className="tabular">−{fmt(runFor.fees)}</dd></div>
                <div className="flex justify-between border-t border-ink-200 pt-1 font-semibold"><dt>Net payable</dt><dd className="tabular">{fmt(runFor.net)}</dd></div>
              </dl>
            </div>
          )
        }
        onConfirm={async () => {
          if (!runFor) return;
          const r = await run.run(runFor.vendor.id);
          if (r) {
            toast({ tone: "success", title: `${r.reference} submitted (simulated)`, body: `${r.orders} orders · ${fmt(r.net)}` });
            setRunFor(null);
            setTab("history");
          }
        }}
      />
      <ConfirmDialog
        open={!!resolve}
        onClose={() => setResolve(null)}
        title={`Resolve ${resolve?.reference}`}
        description={resolve?.providerStatus}
        reasonLabel="How was the exception resolved?"
        confirmLabel="Mark reconciled"
        pending={reconcile.pending}
        error={reconcile.error?.message}
        onConfirm={async (reason) => {
          if (resolve && (await reconcile.run(resolve.id, reason)) !== undefined) {
            toast({ tone: "success", title: "Reconciliation updated" });
            setResolve(null);
          }
        }}
      />
    </>
  );
}
