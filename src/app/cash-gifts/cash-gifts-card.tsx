"use client";

import { useState } from "react";
import { BellRing, Banknote, Send } from "lucide-react";
import { api, useApi, useMutation, usePagedApi } from "@/shared/lib/api";
import { useSession } from "@/shared/lib/session";
import { dateTime, timeAgo } from "@/shared/lib/format";
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
  /** When the recipient was last asked to add bank details, and why a reminder can't be sent now (null when it can). */
  remindedAt: string | null;
  remindBlocked: string | null;
  /** The engine that sent it, and whether it's waiting for the engine to confirm the bank has it. */
  transferGateway: string | null;
  transferPending: boolean;
  transferSubmittedAt: string | null;
  /** Why the last transfer attempt failed (it can be tried again). */
  failureReason: string | null;
};

/** What sends money out now: e.g. "Paystack (test)" for Nigerian banks, Stripe abroad, or simulated when none is set up. */
type PayoutEngines = { nigeria: string | null; stripe: string | null; simulated: boolean };

function engineText(e: PayoutEngines | null | undefined) {
  if (!e) return null;
  const real = [e.nigeria && `${e.nigeria} for Nigerian banks`, e.stripe && `${e.stripe} outside Nigeria`].filter(Boolean).join(", ");
  if (real) return `Transfers go through ${real}.`;
  return e.simulated
    ? "No payout engine is set up, so transfers are simulated (no real money). A super admin can add Paystack or Flutterwave keys under Settings → Payment engines."
    : "No payout engine is set up. A super admin can add Paystack or Flutterwave keys under Settings → Payment engines.";
}

const statusTone: Record<string, "success" | "warning" | "neutral" | "danger" | "plum"> = { Received: "success", PaidOut: "plum", PayoutPending: "warning", PaymentPending: "neutral", Failed: "danger", Paid: "plum" };
const statusLabel: Record<string, string> = { PayoutPending: "Paid · to transfer", PaidOut: "Transferred · awaiting receipt", Received: "Received by recipient", PaymentPending: "Not paid", Failed: "Failed", Paid: "Paid" };

/** Admin → Money → Cash gifts: money senders gave instead of gifts, the SecretWish fee, the transfer and the recipient's receipt. */
export function CashGiftsCard() {
  const [status, setStatus] = useState("");
  const { data, items, error, loading, reload, setPage, search, setSearch } = usePagedApi<CashGift>("/admin/cash-gifts", { status }, 15);
  const { fmt } = useSession();
  const toast = useToast();
  const [transferring, setTransferring] = useState<CashGift | null>(null);
  const engines = useApi<PayoutEngines>("/admin/payout-engines");
  const transfer = useMutation((id: string) => api<{ via: string; pending: boolean; amount: string }>(`/admin/cash-gifts/${id}/process`, { method: "POST" }));
  // Errors come back as the result so the toast can show them straight away.
  const remind = useMutation((id: string) =>
    api<{ emailed: boolean }>(`/admin/cash-gifts/${id}/remind`, { method: "POST" }).catch((e: Error) => ({ emailed: false, error: e.message })),
  );
  const [reminding, setReminding] = useState<string | null>(null);
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
          <Badge tone={g.transferPending ? "plum" : statusTone[g.status] ?? "neutral"}>{g.transferPending ? "Sending to bank" : statusLabel[g.status] ?? g.status}</Badge>
          {g.status === "PayoutPending" && !g.hasBankDetails && (
            <p className="text-[11px] text-warning-700">Waiting for bank details{g.remindedAt && ` · reminded ${timeAgo(g.remindedAt)}`}</p>
          )}
          {g.transferPending && <p className="text-[11px] text-plum-700">Sent with {g.transferGateway} · waiting for the bank{g.transferSubmittedAt && ` · ${timeAgo(g.transferSubmittedAt)}`}</p>}
          {g.status === "PayoutPending" && !g.transferPending && g.failureReason && <p className="max-w-[240px] text-[11px] text-danger-700">{g.failureReason}. You can try again.</p>}
          {g.processedBy && <p className="text-[11px] text-ink-500">Sent by {g.processedBy}{g.transferGateway && ` with ${g.transferGateway}`}{g.paidOutAt && ` · ${dateTime(g.paidOutAt)}`}</p>}
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
        g.status !== "PayoutPending" || g.transferPending ? null : g.hasBankDetails ? (
          <Button size="sm" icon={Send} disabled={!!g.transferBlocked} title={g.transferBlocked ?? undefined} onClick={() => setTransferring(g)}>
            {g.failureReason ? "Try again" : "Transfer"}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            icon={BellRing}
            disabled={!!g.remindBlocked}
            title={g.remindBlocked ?? "Ask the recipient to add bank details, in the app and by email"}
            loading={remind.pending && reminding === g.id}
            onClick={async () => {
              setReminding(g.id);
              const r = await remind.run(g.id);
              setReminding(null);
              if (r && "error" in r) toast({ tone: "error", title: "Couldn't send the reminder", body: r.error });
              else if (r) toast({ tone: "success", title: `Reminder sent for ${g.reference}`, body: r.emailed ? "They got an in-app notice and an email." : "They got an in-app notice. Email isn't set up, so no email went out." });
              reload();
            }}
          >
            Remind
          </Button>
        ),
    },
  ];
  return (
    <Card>
      <CardHeader
        title="Cash gifts"
        description={`Senders pay SecretWish; staff transfer the money once the recipient adds bank details, then the recipient confirms it arrived. ${engineText(engines.data) ?? ""}`}
        action={data?.counts ? <Badge tone={data.counts.readyToTransfer ? "warning" : "success"} icon={Banknote}>{data.counts.readyToTransfer ?? 0} ready to transfer{data.counts.sending ? ` · ${data.counts.sending} sending` : ""} · {(data.counts.awaitingPayout ?? 0) - (data.counts.readyToTransfer ?? 0) - (data.counts.sending ?? 0)} need bank details</Badge> : undefined}
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
        description={`Sends the money to the recipient's saved bank account and asks them to confirm it arrived. ${engineText(engines.data) ?? ""} This is recorded in the audit log.`}
        confirmLabel="Transfer now"
        pending={transfer.pending}
        error={transfer.error?.message}
        onConfirm={async () => {
          const r = transferring ? await transfer.run(transferring.id) : undefined;
          if (transferring && r !== undefined) {
            toast(r.pending
              ? { tone: "success", title: `${transferring.reference} sent with ${r.via}`, body: `${r.amount} is on its way. It's marked transferred when ${r.via} confirms the bank has it.` }
              : { tone: "success", title: `${transferring.reference} transferred with ${r.via}`, body: `${r.amount}. The recipient has been asked to confirm it arrived.` });
            setTransferring(null);
            reload();
          }
        }}
      />
    </Card>
  );
}
