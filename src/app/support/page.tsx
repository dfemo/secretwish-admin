"use client";

import { PagedFooter } from "@/shared/ui/data";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LifeBuoy, Lock, Send } from "lucide-react";
import { api, useApi, useMutation, type Paged } from "@/shared/lib/api";
import { useSession } from "@/shared/lib/session";
import { dateTime, humanize, timeAgo } from "@/shared/lib/format";
import { Badge, Button, Card, cx, EmptyState, ErrorState, KpiCard, PageHeader, Select, Spinner, StatusBadge, Switch, Tabs, Textarea, SearchInput } from "@/shared/ui/primitives";
import { Modal, useToast } from "@/shared/ui/overlay";
import { WebsiteEnquiries } from "./enquiries";

type Ticket = {
  id: string; reference: string; category: string; priority: string; status: string; subject: string; description: string; assignedTo?: string; createdAt: string; resolvedAt?: string;
  raisedBy: string; raisedByRole: string; order?: { id: string; reference: string; status: string; deliveryCity: string };
  notes?: { id: string; author: string; body: string; internal: boolean; at: string }[];
};
type Data = { summary: { open: number; urgent: number; lateDeliveries: number; missingGifts: number; refundRequests: number; privacy: number; disputes: number; avgResolutionHours: number }; tickets: Paged<Ticket> };

const agents = ["Amaka Eze", "Tolu Bakare"];
const priorityTone: Record<string, "danger" | "warning" | "plum" | "neutral"> = { Urgent: "danger", High: "warning", Normal: "plum", Low: "neutral" };

function SupportInner() {
  const params = useSearchParams();
  const [status, setStatus] = useState("active");
  const [category, setCategory] = useState("");
  const [assignee, setAssignee] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [status, category, assignee, debounced]);
  const { data, error, loading, reload } = useApi<Data>(`/admin/tickets?status=${status}&category=${category}&assignee=${encodeURIComponent(assignee)}&search=${encodeURIComponent(debounced)}&page=${page}&pageSize=20`);
  const [openId, setOpenId] = useState<string | null>(params.get("ticket"));
  const { persona } = useSession();

  const s = data?.summary;
  return (
    <>
      <PageHeader title="Customer Support" description="Tickets show masked customer details by default. Internal notes are never visible to customers or vendors." />
      {s && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
          <KpiCard tint="plum" label="Open" value={s.open} />
          <KpiCard tint="rose" label="Urgent" value={s.urgent} />
          <KpiCard tint="gold" label="Late deliveries" value={s.lateDeliveries} />
          <KpiCard tint="rose" label="Missing gifts" value={s.missingGifts} />
          <KpiCard tint="lavender" label="Refund requests" value={s.refundRequests} />
          <KpiCard tint="ivory" label="Privacy" value={s.privacy} />
          <KpiCard tint="lavender" label="Disputes" value={s.disputes} />
          <KpiCard tint="sage" label="Avg. resolution" value={`${s.avgResolutionHours}h`} />
        </div>
      )}
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
          <Tabs value={status} onChange={setStatus} tabs={[{ value: "active", label: "Active" }, { value: "Open", label: "Open" }, { value: "Pending", label: "Awaiting customer" }, { value: "Resolved", label: "Resolved" }, { value: "", label: "All" }]} />
          <label htmlFor="cat" className="sr-only">Category</label>
          <Select id="cat" value={category} onChange={(e) => setCategory(e.target.value)} className="w-44">
            <option value="">All categories</option>
            {["LateDelivery", "MissingGift", "RefundRequest", "PrivacyComplaint", "Dispute", "General"].map((c) => (<option key={c} value={c}>{humanize(c)}</option>))}
          </Select>
          <label htmlFor="as" className="sr-only">Assignee</label>
          <Select id="as" value={assignee} onChange={(e) => setAssignee(e.target.value)} className="w-44">
            <option value="">Anyone</option>
            <option value="unassigned">Unassigned</option>
            <option value={persona.name}>Assigned to me</option>
          </Select>
        </div>
        {loading && <Spinner />}
        {error && <ErrorState error={error} onRetry={reload} />}
        <div className="border-b border-ink-100 p-4"><SearchInput value={search} onChange={setSearch} label="Search tickets" placeholder="Reference or subject" className="sm:w-80" /></div>
        {data?.tickets.items.length === 0 && <EmptyState icon={LifeBuoy} title="Inbox zero" description="No tickets match these filters." />}
        <ul className="divide-y divide-ink-100">
          {data?.tickets.items.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => setOpenId(t.id)} className="flex w-full flex-wrap items-center gap-3 px-5 py-3.5 text-left hover:bg-plum-50/40">
                <Badge tone={priorityTone[t.priority]}>{t.priority}</Badge>
                <div className="min-w-[200px] flex-1">
                  <p className="text-sm font-semibold">{t.subject}</p>
                  <p className="text-xs text-ink-500">
                    {t.reference} · {humanize(t.category)} · {t.raisedBy} ({t.raisedByRole}) · {timeAgo(t.createdAt)}
                    {t.order && ` · ${t.order.reference}`}
                  </p>
                </div>
                <span className="text-xs text-ink-500">{t.assignedTo ?? "Unassigned"}</span>
                <StatusBadge status={t.status} />
              </button>
            </li>
          ))}
        </ul>
        <PagedFooter data={data?.tickets} onPage={setPage} />
      </Card>
      <WebsiteEnquiries />
      {openId && <TicketModal id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}

function TicketModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: fetched, error, loading, reload } = useApi<Ticket>(`/admin/tickets/${id}`);
  const [t, setT] = useState<Ticket | null>(null);
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(true);
  const toast = useToast();
  useEffect(() => { if (fetched) setT(fetched); }, [fetched]);
  const note = useMutation(() => api<Ticket>(`/admin/tickets/${id}/notes`, { method: "POST", body: { body, internal } }));
  const assign = useMutation((a: string) => api<Ticket>(`/admin/tickets/${id}/assign`, { method: "POST", body: { assignee: a || null } }));
  const setStatus = useMutation((s: string) => api<Ticket>(`/admin/tickets/${id}/status`, { method: "POST", body: { status: s } }));

  return (
    <Modal open onClose={onClose} size="lg" title={t ? t.subject : "Ticket"} description={t ? `${t.reference} · ${humanize(t.category)} · raised by ${t.raisedBy}` : undefined}>
      {loading && <Spinner />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {t && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={t.status} />
            <Badge tone={priorityTone[t.priority]}>{t.priority}</Badge>
            {t.order && <Link href={`/orders/${t.order.id}`} className="text-sm font-semibold text-plum-700 hover:underline">Order {t.order.reference} ({t.order.deliveryCity}) →</Link>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="assignee" className="text-xs font-semibold text-ink-500">Assigned to</label>
              <Select id="assignee" value={t.assignedTo ?? ""} onChange={async (e) => { const r = await assign.run(e.target.value); if (r) setT(r); }}>
                <option value="">Unassigned</option>
                {agents.map((a) => (<option key={a}>{a}</option>))}
              </Select>
            </div>
            <div>
              <label htmlFor="tstatus" className="text-xs font-semibold text-ink-500">Status</label>
              <Select id="tstatus" value={t.status} onChange={async (e) => { const r = await setStatus.run(e.target.value); if (r) { setT(r); toast({ tone: "success", title: `Ticket ${e.target.value.toLowerCase()}` }); } }}>
                {["Open", "Pending", "Resolved", "Closed"].map((s) => (<option key={s}>{s}</option>))}
              </Select>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-ink-500">Conversation & resolution history</p>
            <ol className="space-y-2">
              {t.notes?.map((n) => (
                <li key={n.id} className={cx("rounded-xl px-3 py-2", n.internal ? "border border-dashed border-gold-400 bg-gold-100/40" : "bg-ink-50")}>
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-500">
                    {n.internal && <Lock className="size-3 text-gold-700" aria-label="Internal note" />}
                    {n.author} · {dateTime(n.at)} {n.internal && "· internal"}
                  </p>
                  <p className="text-[13px]">{n.body}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-2xl border border-ink-200 p-3">
            <label htmlFor="reply" className="sr-only">Message</label>
            <Textarea id="reply" value={body} onChange={(e) => setBody(e.target.value)} placeholder={internal ? "Internal note for the team…" : "Reply to the customer…"} />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="w-64"><Switch checked={internal} onChange={setInternal} label="Internal note" description={internal ? "Only SecretWish staff will see this." : "The customer will be notified."} /></div>
              <Button icon={Send} disabled={body.trim().length < 2} loading={note.pending} onClick={async () => { const r = await note.run(); if (r) { setT(r); setBody(""); toast({ tone: "success", title: internal ? "Internal note added" : "Reply sent (simulated notification)" }); } }}>
                {internal ? "Add note" : "Send reply"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <SupportInner />
    </Suspense>
  );
}
