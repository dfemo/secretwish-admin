"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { useApi, type Paged } from "@/shared/lib/api";
import { useSession } from "@/shared/lib/session";
import { dateTime, pct } from "@/shared/lib/format";
import { Card, EmptyState, ErrorState, KpiCard, Notice, PageHeader, SearchInput, Select, Spinner, StatusBadge } from "@/shared/ui/primitives";
import { DataTable, PagedFooter, type Column } from "@/shared/ui/data";

type Payment = { id: string; at: string; kind: string; amount: number; status: string; provider: string; providerReference: string; method: string; failureReason?: string; orderId: string; orderReference: string };
type Data = { summary: { counts: { charges: number; succeeded: number; failed: number; pending: number }; refundedAmount: number }; page: Paged<Payment> };

const n = (v: number) => (v >= 10000 ? "10,000+" : v.toLocaleString());

export default function PaymentsPage() {
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [status, kind, debounced]);
  const { data, error, loading, reload } = useApi<Data>(`/admin/payments?status=${status}&kind=${kind}&search=${encodeURIComponent(debounced)}&page=${page}`);
  const { fmt } = useSession();

  const cols: Column<Payment>[] = [
    { key: "ref", header: "Provider reference", render: (p) => <span className="font-mono text-xs">{p.providerReference}</span> },
    { key: "order", header: "Order", render: (p) => <Link href={`/orders/${p.orderId}`} className="font-semibold text-plum-700 hover:underline">{p.orderReference}</Link> },
    { key: "kind", header: "Type", render: (p) => `${p.kind} · ${p.method}` },
    { key: "amount", header: "Amount", align: "right", render: (p) => <span className={p.kind === "Refund" ? "text-danger-700" : ""}>{p.kind === "Refund" ? "−" : ""}{fmt(p.amount)}</span> },
    { key: "status", header: "Status", render: (p) => (<div><StatusBadge status={p.status} />{p.failureReason && <p className="mt-0.5 text-[11px] text-danger-700">{p.failureReason}</p>}</div>) },
    { key: "provider", header: "Provider", hideOnMobile: true, render: (p) => <span className="text-xs">{p.provider}</span> },
    { key: "at", header: "When", render: (p) => <span className="text-xs">{dateTime(p.at)}</span> },
  ];

  return (
    <>
      <PageHeader title="Payments & Transactions" description="Charges and refunds as reported by the payment provider." />
      <Notice className="mb-6" tone="gold" title="Simulated payment provider">
        All transactions are sandbox or simulated records. No real cards are charged and no real refunds are issued. Production would integrate a licensed provider (e.g. Paystack or Flutterwave) via server-side webhooks.
      </Notice>
      {data && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard tint="plum" label="Charge attempts" value={n(data.summary.counts.charges)} />
          <KpiCard tint="sage" label="Successful" value={n(data.summary.counts.succeeded)} hint={data.summary.counts.charges < 10000 ? pct((data.summary.counts.succeeded / Math.max(1, data.summary.counts.charges)) * 100) + " success rate" : undefined} />
          <KpiCard tint="rose" label="Failed" value={n(data.summary.counts.failed)} hint={`${n(data.summary.counts.pending)} pending`} />
          <KpiCard tint="gold" label="Refunded" value={fmt(data.summary.refundedAmount)} />
        </div>
      )}
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
          <SearchInput value={search} onChange={setSearch} label="Search payments" placeholder="Provider or order reference" className="min-w-[200px] flex-1" />
          <label htmlFor="kind" className="sr-only">Type</label>
          <Select id="kind" value={kind} onChange={(e) => setKind(e.target.value)} className="w-36">
            <option value="">All types</option>
            <option value="Charge">Charges</option>
            <option value="Refund">Refunds</option>
          </Select>
          <label htmlFor="st" className="sr-only">Status</label>
          <Select id="st" value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
            <option value="">All statuses</option>
            {["Succeeded", "Failed", "Pending", "Refunded"].map((s) => (<option key={s}>{s}</option>))}
          </Select>
        </div>
        {loading && <Spinner />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {data && (
          <>
            <DataTable caption="Payments" columns={cols} rows={data.page.items} rowKey={(p) => p.id} empty={<EmptyState icon={CreditCard} title="No transactions match" />} />
            <PagedFooter data={data.page} onPage={setPage} />
          </>
        )}
      </Card>
    </>
  );
}
