"use client";

import { useState } from "react";
import { Banknote, Send } from "lucide-react";
import { api, useMutation, usePagedApi } from "@/shared/lib/api";
import { useSession } from "@/shared/lib/session";
import { dateTime } from "@/shared/lib/format";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, SearchInput, Select, Spinner } from "@/shared/ui/primitives";
import { ConfirmDialog, useToast } from "@/shared/ui/overlay";
import { DataTable, PagedFooter, type Column } from "@/shared/ui/data";

type CashGift = {
  id: string; reference: string; amountUsd: number; feeUsd: number; totalUsd: number; status: string; createdAt: string; paidOutAt: string | null;
  paymentReference: string | null; payoutReference: string | null; sender: string; recipient: string;
  recipientPhone: string | null; recipientCity: string; hasBankDetails: boolean; processedBy: string | null;
  receivedAt: string | null; thankYouNote: string | null;
  /** Why staff can't transfer it yet; null when the viewer can. */
  transferBlocked: string | null;
};

const statusTone: Record<string, "success" | "warning" | "neutral" | "danger" | "plum"> = { Received: "success", PaidOut: "plum", PayoutPending: "warning", PaymentPending: "neutral", Failed: "danger", Paid: "plum" };
const statusLabel: Record<string, string> = { PayoutPending: "Paid · to transfer", PaidOut: "Transferred · awaiting receipt", Received: "Received by recipient", PaymentPending: "Not paid", Failed: "Failed", Paid: "Paid" };

/** Admin → Money → Cash gifts: money senders gave instead of gifts, the SecretWish fee, the transfer and the recipient's receipt. */
export function CashGiftsCard() {
  const [status, setStatus] = useState("");
  const { data, items, error, loading, reload, setPage, search, setSearch } = usePagedApi<CashGift>("/admin/cash-gifts", { status }, 15);
  const { fmt } = useSession();
  const toast = useToast();
  const [transferring, setTransferring] = useState<CashGift | null>(null);
  const transfer = useMutation((id: string) => api(`/admin/cash-gifts/${id}/process`, { method: "POST" }));
  const cols: Column<CashGift>[] = [
    {
      key: "ref",
      header: "Cash gift",
      render: (g) => (
        <div>
          <p className="font-semibold">{g.reference}</p>
          <p className="text-xs text-ink-500">{g.sender} → {g.recipient}</p>
          <p className="text-[11px] text-ink-500">{[g.recipientPhone, g.recipientCity].filter(Boolean).join(" · ") || "No phone or city yet"}</p>
        </div>
      ),
    },
    { key: "at", header: "Date", render: (g) => <span className="text-xs whitespace-nowrap">{dateTime(g.createdAt)}</span> },
    { key: "amt", header: "To recipient", align: "right", render: (g) => fmt(g.amountUsd) },
    { key: "fee", header: "Fee", align: "right", hideOnMobile: true, render: (g) => fmt(g.feeUsd) },
    {
      key: "s",
      header: "Status",
      render: (g) => (
        <div className="space-y-1">
          <Badge tone={statusTone[g.status] ?? "neutral"}>{statusLabel[g.status] ?? g.status}</Badge>
          {g.status === "PayoutPending" && !g.hasBankDetails && <p className="text-[11px] text-warning-700">Waiting for bank details</p>}
          {g.processedBy && <p className="text-[11px] text-ink-500">Sent by {g.processedBy}{g.paidOutAt && ` · ${dateTime(g.paidOutAt)}`}</p>}
          {g.receivedAt && <p className="text-[11px] text-success-700">Confirmed {dateTime(g.receivedAt)}</p>}
          {g.thankYouNote && <p className="max-w-[220px] text-[11px] text-ink-700 italic">“{g.thankYouNote}”</p>}
        </div>
      ),
    },
    { key: "ref2", header: "Provider ref", hideOnMobile: true, render: (g) => <span className="font-mono text-[11px] text-ink-500">{g.payoutReference ?? g.paymentReference ?? "—"}</span> },
    {
      key: "act",
      header: "",
      render: (g) =>
        g.status === "PayoutPending" ? (
          <Button size="sm" icon={Send} disabled={!!g.transferBlocked} title={g.transferBlocked ?? undefined} onClick={() => setTransferring(g)}>
            Transfer
          </Button>
        ) : null,
    },
  ];
  return (
    <Card>
      <CardHeader
        title="Cash gifts"
        description="Senders pay SecretWish; staff transfer the money once the recipient adds bank details, then the recipient confirms it arrived. Transfers are simulated."
        action={data?.counts ? <Badge tone={data.counts.readyToTransfer ? "warning" : "success"} icon={Banknote}>{data.counts.readyToTransfer ?? 0} ready to transfer · {(data.counts.awaitingPayout ?? 0) - (data.counts.readyToTransfer ?? 0)} need bank details</Badge> : undefined}
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
      <ConfirmDialog
        open={!!transferring}
        onClose={() => { setTransferring(null); transfer.setError(null); }}
        title={`Transfer ${transferring ? fmt(transferring.amountUsd) : ""} to ${transferring?.recipient}`}
        description="Sends the money to the recipient's saved bank account (simulated) and asks them to confirm it arrived. This is recorded in the audit log."
        confirmLabel="Transfer now"
        pending={transfer.pending}
        error={transfer.error?.message}
        onConfirm={async () => {
          if (transferring && (await transfer.run(transferring.id)) !== undefined) {
            toast({ tone: "success", title: `${transferring.reference} transferred`, body: "The recipient has been asked to confirm it arrived." });
            setTransferring(null);
            reload();
          }
        }}
      />
    </Card>
  );
}
