"use client";

import { useState } from "react";
import { Banknote } from "lucide-react";
import { usePagedApi } from "@/shared/lib/api";
import { useSession } from "@/shared/lib/session";
import { dateTime } from "@/shared/lib/format";
import { Badge, Card, CardHeader, EmptyState, ErrorState, SearchInput, Select, Spinner } from "@/shared/ui/primitives";
import { DataTable, PagedFooter, type Column } from "@/shared/ui/data";

type CashGift = {
  id: string; reference: string; amountUsd: number; feeUsd: number; totalUsd: number; status: string; createdAt: string; paidOutAt: string | null;
  paymentReference: string | null; payoutReference: string | null; sender: string; recipient: string;
};

const statusTone: Record<string, "success" | "warning" | "neutral" | "danger" | "plum"> = { PaidOut: "success", PayoutPending: "warning", PaymentPending: "neutral", Failed: "danger", Paid: "plum" };
const statusLabel: Record<string, string> = { PaidOut: "Paid out", PayoutPending: "Awaiting bank details", PaymentPending: "Not paid", Failed: "Failed", Paid: "Paid" };

/** Admin → Payments: money senders gave instead of gifts, the SecretWish fee, and whether the recipient has been paid. */
export function CashGiftsCard() {
  const [status, setStatus] = useState("");
  const { data, items, error, loading, reload, setPage, search, setSearch } = usePagedApi<CashGift>("/admin/cash-gifts", { status }, 15);
  const { fmt } = useSession();
  const cols: Column<CashGift>[] = [
    { key: "ref", header: "Cash gift", render: (g) => (<div><p className="font-semibold">{g.reference}</p><p className="text-xs text-ink-500">{g.sender} → {g.recipient}</p></div>) },
    { key: "at", header: "Date", render: (g) => <span className="text-xs whitespace-nowrap">{dateTime(g.createdAt)}</span> },
    { key: "amt", header: "To recipient", align: "right", render: (g) => fmt(g.amountUsd) },
    { key: "fee", header: "Fee", align: "right", hideOnMobile: true, render: (g) => fmt(g.feeUsd) },
    { key: "s", header: "Status", render: (g) => <Badge tone={statusTone[g.status] ?? "neutral"}>{statusLabel[g.status] ?? g.status}</Badge> },
    { key: "ref2", header: "Provider ref", hideOnMobile: true, render: (g) => <span className="font-mono text-[11px] text-ink-500">{g.payoutReference ?? g.paymentReference ?? "—"}</span> },
  ];
  return (
    <Card className="mt-6">
      <CardHeader
        title="Cash gifts"
        description="Simulated charges and transfers, like vendor payouts."
        action={data?.counts ? <Badge tone={data.counts.awaitingPayout ? "warning" : "success"} icon={Banknote}>{data.counts.awaitingPayout} awaiting bank details</Badge> : undefined}
      />
      <div className="flex flex-wrap items-center gap-3 border-y border-ink-100 p-4">
        <SearchInput value={search} onChange={setSearch} label="Search cash gifts" placeholder="Reference" className="min-w-[200px] flex-1" />
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-56">
          <option value="">All statuses</option>
          {Object.entries(statusLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </div>
      {loading && <Spinner />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {items && <DataTable caption="Cash gifts" columns={cols} rows={items} rowKey={(g) => g.id} empty={<EmptyState icon={Banknote} title="No cash gifts match" />} />}
      <PagedFooter data={data} onPage={setPage} />
    </Card>
  );
}
