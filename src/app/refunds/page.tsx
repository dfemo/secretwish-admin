"use client";

import { PagedFooter } from "@/shared/ui/data";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RotateCcw, UserPlus } from "lucide-react";
import { api, useApi, useMutation, usePagedApi } from "@/shared/lib/api";
import { useSession } from "@/shared/lib/session";
import { useAccess } from "@/lib/access";
import { dateTime, timeAgo } from "@/shared/lib/format";
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Notice, PageHeader, Select, Spinner, StatusBadge, Tabs, Textarea, SearchInput } from "@/shared/ui/primitives";
import { Modal, useToast } from "@/shared/ui/overlay";

type Case = {
  id: string; reference: string; type: string; status: string; reason: string; amount: number; raisedBy: string; assignedTo?: string;
  decision?: string; decisionNote?: string; chargebackStatus?: string; evidence: string; createdAt: string; decidedAt?: string;
  order: { id: string; reference: string; status: string; total: number; vendor: string; paidOut: boolean };
};

const agents = ["Amaka Eze", "Tolu Bakare", "Chidi Okafor"];

function RefundsInner() {
  const params = useSearchParams();
  const [type, setType] = useState(params.get("type") ?? "");
  const [status, setStatus] = useState("open");
  const { data: paged, items: data, error, loading, reload, setPage, search, setSearch } = usePagedApi<Case>("/admin/cases", { type, status }, 20);
  const { fmt, persona } = useSession();
  const toast = useToast();
  const [selected, setSelected] = useState<Case | null>(null);
  const [decision, setDecision] = useState("approve-refund");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [confirming, setConfirming] = useState(false);
  const decide = useMutation((id: string) => api<Case>(`/admin/cases/${id}/decide`, { method: "POST", body: { decision, reason, amount: amount ? Number(amount) : null } }));
  const assign = useMutation((id: string, assignee: string) => api<Case>(`/admin/cases/${id}/assign`, { method: "POST", body: { assignee } }));
  const addEvidence = useMutation((id: string) => api<Case>(`/admin/cases/${id}/evidence`, { method: "POST", body: { body: evidence } }));
  const { can } = useAccess();
  const canDecide = can("refunds.decide");
  const canWork = can("refunds.manage");
  const open = (c: Case) => {
    setSelected(c);
    setDecision(c.type === "Chargeback" ? "reject" : "approve-refund");
    setReason("");
    setAmount("");
    setEvidence("");
    setConfirming(false);
    decide.setError(null);
  };
  const isOpen = (c: Case) => ["Open", "InReview", "AwaitingEvidence"].includes(c.status);

  return (
    <>
      <PageHeader title="Refunds & Disputes" description="Every case has an owner, evidence and a recorded decision. Refunds are simulated — no real money moves." />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
          <Tabs value={type} onChange={setType} tabs={[{ value: "", label: "All cases" }, { value: "Refund", label: "Refunds" }, { value: "Dispute", label: "Disputes" }, { value: "Chargeback", label: "Chargebacks" }]} />
          <label htmlFor="cs" className="sr-only">Status</label>
          <Select id="cs" value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
            <option value="open">Open cases</option>
            <option value="">All statuses</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </Select>
        </div>
        {loading && <Spinner />}
        {error && <ErrorState error={error} onRetry={reload} />}
        <div className="border-b border-ink-100 p-4"><SearchInput value={search} onChange={setSearch} label="Search cases" placeholder="Case or order reference" className="sm:w-80" /></div>
        {data?.length === 0 && <EmptyState icon={RotateCcw} title={search ? "No cases match" : "No cases here"} description={search ? undefined : "The queue is clear."} />}
        <ul className="divide-y divide-ink-100">
          {data?.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => open(c)} className="flex w-full flex-wrap items-center gap-4 px-5 py-4 text-left hover:bg-plum-50/40">
                <div className="min-w-[200px] flex-1">
                  <p className="font-semibold">
                    {c.reference} · <span className="text-plum-700">{c.order.reference}</span> <Badge tone={c.type === "Chargeback" ? "danger" : c.type === "Dispute" ? "warning" : "plum"}>{c.type}</Badge>
                  </p>
                  <p className="text-[13px] text-ink-700">{c.reason}</p>
                  <p className="text-xs text-ink-500">
                    Raised by {c.raisedBy} · {timeAgo(c.createdAt)} · {c.order.vendor}
                    {c.chargebackStatus && ` · ${c.chargebackStatus}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular">{fmt(c.amount)}</p>
                  <p className="text-xs text-ink-500">{c.assignedTo ? `Owner: ${c.assignedTo}` : "Unassigned"}</p>
                </div>
                <StatusBadge status={c.status} />
              </button>
            </li>
          ))}
        </ul>
        <PagedFooter data={paged} onPage={setPage} />
      </Card>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        size="lg"
        title={selected ? `${selected.reference} · ${selected.type}` : ""}
        description={selected ? `Order ${selected.order.reference} · ${fmt(selected.order.total)} · ${selected.order.vendor}` : undefined}
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={selected.status} />
              <Link href={`/orders/${selected.order.id}`} className="text-sm font-semibold text-plum-700 hover:underline">Open order →</Link>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-500">Reason</p>
              <p className="text-sm">{selected.reason}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-500">Evidence log</p>
              <pre className="mt-1 rounded-xl bg-ink-50 p-3 font-sans text-[13px] whitespace-pre-wrap">{selected.evidence || "No evidence recorded yet."}</pre>
              {isOpen(selected) && (
                <div className="mt-2 flex gap-2">
                  <label htmlFor="ev" className="sr-only">Add evidence</label>
                  <Input id="ev" value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Add evidence note (photos received, courier POD…)" />
                  <Button variant="secondary" disabled={evidence.trim().length < 3} loading={addEvidence.pending} onClick={async () => { const r = await addEvidence.run(selected.id); if (r) { setSelected(r); setEvidence(""); } }}>Add</Button>
                </div>
              )}
            </div>
            {isOpen(selected) && (
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Case owner" className="min-w-[200px] flex-1">
                  {(id) => (
                    <Select id={id} value={selected.assignedTo ?? ""} onChange={async (e) => { const r = await assign.run(selected.id, e.target.value); if (r) { setSelected(r); toast({ tone: "success", title: `Assigned to ${e.target.value}` }); } }}>
                      <option value="" disabled>Unassigned</option>
                      {agents.map((a) => (<option key={a}>{a}</option>))}
                    </Select>
                  )}
                </Field>
                {!selected.assignedTo && canWork && <Button variant="subtle" icon={UserPlus} onClick={async () => { const r = await assign.run(selected.id, persona.name); if (r) setSelected(r); }}>Assign to me</Button>}
              </div>
            )}
            {selected.decision ? (
              <Notice tone={selected.status === "Approved" ? "success" : "neutral"} title={`Decision: ${selected.decision}`}>
                {selected.decisionNote} {selected.decidedAt && `· ${dateTime(selected.decidedAt)}`}
              </Notice>
            ) : canDecide ? (
              <div className="space-y-3 rounded-2xl border border-ink-200 p-4">
                <p className="text-sm font-semibold">Record a decision</p>
                {selected.order.paidOut && <Notice tone="warning">This order was already paid out to the vendor. Refunding would require a vendor adjustment (not modelled in the prototype).</Notice>}
                <Field label="Decision">
                  {(id) => (
                    <Select id={id} value={decision} onChange={(e) => setDecision(e.target.value)}>
                      <option value="approve-refund">Approve full refund ({fmt(selected.amount)})</option>
                      <option value="partial-refund">Approve partial refund</option>
                      <option value="reject">{selected.type === "Chargeback" ? "Contest chargeback with evidence" : "Decline refund"}</option>
                    </Select>
                  )}
                </Field>
                {decision === "partial-refund" && (
                  <Field label="Refund amount (USD)" hint={`Up to ${fmt(selected.amount)}`}>
                    {(id, d) => <Input id={id} aria-describedby={d} type="number" min={1} max={selected.amount} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />}
                  </Field>
                )}
                <Field label="Reason (recorded in audit log)" required>
                  {(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}
                </Field>
                {decide.error && <Notice tone="danger">{decide.error.message}</Notice>}
                {!confirming ? (
                  <Button disabled={reason.trim().length < 3 || (decision === "partial-refund" && !(Number(amount) > 0))} onClick={() => setConfirming(true)}>
                    Review decision
                  </Button>
                ) : (
                  <div className="rounded-xl bg-warning-50 p-3 text-[13px] text-warning-700">
                    <p className="font-semibold">Confirm: {decision === "reject" ? "decline / contest" : `refund ${fmt(decision === "partial-refund" ? Number(amount) : selected.amount)}`}</p>
                    <p>This notifies the sender and vendor and cannot be undone in the prototype. The refund is simulated.</p>
                    <div className="mt-2 flex gap-2">
                      <Button variant={decision === "reject" ? "primary" : "danger"} loading={decide.pending} onClick={async () => { const r = await decide.run(selected.id); if (r) { setSelected(r); toast({ tone: "success", title: "Decision recorded", body: decision === "reject" ? "Order restored to its previous status." : "Refund marked complete (simulated)." }); } }}>Confirm decision</Button>
                      <Button variant="ghost" onClick={() => setConfirming(false)}>Back</Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Notice>Support can assign cases and add evidence. Finance or Operations make the decision.</Notice>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

export default function RefundsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <RefundsInner />
    </Suspense>
  );
}
