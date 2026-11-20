"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Lock, Radio, RefreshCw } from "lucide-react";
import { useApi, usePagedApi } from "@/shared/lib/api";
import { dateTime } from "@/shared/lib/format";
import { useAccess } from "@/lib/access";
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, SearchInput, Select, Spinner, Tabs } from "@/shared/ui/primitives";
import { DataTable, PagedFooter, type Column } from "@/shared/ui/data";
import { Modal, useToast } from "@/shared/ui/overlay";
import type { Engine } from "./engines";


type Hook = { id: string; provider: string; at: string; outcome: string; type: string | null; reference: string | null; status: string | null; detail: string | null; body: string | null };
const tone: Record<string, "success" | "warning" | "danger" | "neutral"> = { Applied: "success", Duplicate: "neutral", Ignored: "neutral", NoMatch: "warning", StillPending: "warning", BadSignature: "danger", NoKeys: "danger", Unreadable: "danger" };
const label: Record<string, string> = { Applied: "Applied", Duplicate: "Repeat (ignored)", Ignored: "Not used", NoMatch: "No matching transfer", StillPending: "Payment still pending", BadSignature: "Refused: secret didn't match", NoKeys: "Refused: no keys", Unreadable: "Unreadable" };
const problems = ["BadSignature", "NoKeys", "Unreadable", "NoMatch", "StillPending"];
const tabs = ["", "Problems", "Applied", "StillPending", "NoMatch", "BadSignature", "Duplicate", "Ignored", "NoKeys", "Unreadable"] as const;

/** Every webhook the engines sent in the last 30 days and what happened to it: all engines, or one. Super admins only. */
export function WebhookLog({ engine }: { engine?: Engine }) {
  const { isSuperAdmin } = useAccess();
  const toast = useToast();
  const [outcome, setOutcome] = useState<string>("");
  const [days, setDays] = useState("30");
  const [open, setOpen] = useState<Hook | null>(null);
  const { data, items, error, loading, refreshing, reload, setPage, search, setSearch } = usePagedApi<Hook>(
    isSuperAdmin ? "/payments/admin/webhooks" : null, { provider: engine?.toLowerCase(), outcome, days }, 25);
  const providers = useApi<{ providers: { provider: string; webhookUrl: string | null }[] }>(isSuperAdmin && engine ? "/payments/admin/providers" : null);
  const url = providers.data?.providers.find((p) => p.provider === engine)?.webhookUrl;

  if (!isSuperAdmin) return <EmptyState icon={Lock} title="Super admins only" description="Webhook logs show payment engine traffic, so only super admins can see them." />;

  const counts = data?.counts ?? {};
  const problemCount = problems.reduce((n, k) => n + (counts[k] ?? 0), 0);
  const cols: Column<Hook>[] = [
    { key: "at", header: "Received", render: (h) => <span className="text-xs whitespace-nowrap">{dateTime(h.at)}</span> },
    ...(engine ? [] : [{ key: "provider", header: "Engine", render: (h: Hook) => <span className="font-medium">{h.provider}</span> }]),
    { key: "outcome", header: "What happened", render: (h) => <Badge tone={tone[h.outcome] ?? "neutral"}>{label[h.outcome] ?? h.outcome}</Badge> },
    { key: "type", header: "Event", render: (h) => (h.type ? <code className="text-xs">{h.type}</code> : "—") },
    { key: "status", header: "Status", render: (h) => (h.status ? <Badge tone="neutral">{h.status}</Badge> : "—") },
    { key: "reference", header: "Reference", render: (h) => (h.reference ? <code className="text-xs break-all">{h.reference}</code> : "—") },
    { key: "detail", header: "Detail", render: (h) => <span className="text-xs text-ink-700 break-words">{h.detail || "—"}</span> },
  ];

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/webhooks" className="hover:underline">Webhooks</Link>}
        title={engine ? `${engine} webhooks` : "All webhooks"}
        description="What each payment engine sent to VeilWish (SecretWish) and what happened to it. Kept for 30 days. If nothing arrives, check the engine's dashboard has the webhook URL and its secret is saved in Settings → Payment engines."
        actions={<Button variant="secondary" icon={RefreshCw} loading={refreshing} onClick={reload}>Refresh</Button>}
      />
      {engine && url && (
        <Card className="mb-4 flex flex-wrap items-center gap-2 p-4 text-sm">
          <span className="font-semibold text-ink-700">Webhook URL for {engine}</span>
          <code className="min-w-0 flex-1 break-all text-ink-900">{url}</code>
          <Button size="sm" variant="ghost" icon={Copy} onClick={async () => { await navigator.clipboard.writeText(url); toast({ tone: "success", title: "Webhook URL copied" }); }}>Copy</Button>
        </Card>
      )}
      <Card>
        <div className="space-y-3 border-b border-ink-100 p-4">
          <Tabs
            value={outcome}
            onChange={setOutcome}
            tabs={tabs.filter((t) => t === "" || t === "Problems" || counts[t]).map((t) => ({
              value: t,
              label: t === "" ? "All" : t === "Problems" ? "Problems" : label[t],
              count: t === "" ? counts.All ?? 0 : t === "Problems" ? problemCount : counts[t],
            }))}
          />
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput value={search} onChange={setSearch} label="Search webhooks" placeholder="Reference, event, status or detail" className="min-w-[220px] flex-1" />
            <label htmlFor="wh-days" className="sr-only">Received in</label>
            <Select id="wh-days" value={days} onChange={(e) => setDays(e.target.value)} className="w-44">
              <option value="1">Last 24 hours</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
            </Select>
          </div>
        </div>
        {loading && !items && <Spinner />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {items && (
          <DataTable caption={engine ? `${engine} webhooks` : "Webhooks"} columns={cols} rows={items} rowKey={(h) => h.id} onRowClick={setOpen}
            empty={<EmptyState icon={Radio} title="No webhooks match" description={search || outcome ? "Try another filter." : "None have arrived in this period."} />} />
        )}
        <PagedFooter data={data} onPage={setPage} />
      </Card>
      <Modal open={!!open} onClose={() => setOpen(null)} size="xl" title={open ? `${open.provider} webhook` : "Webhook"}
        description={open ? `${dateTime(open.at)} · ${label[open.outcome] ?? open.outcome}` : undefined}>
        {open && (
          <div className="space-y-3 text-sm">
            {open.detail && <p className="text-ink-700">{open.detail}</p>}
            <p className="text-xs text-ink-500">What {open.provider} sent, with account numbers cut to the last 4 digits and names, emails and phones hidden.</p>
            {open.body ? (
              <div className="relative">
                <Button size="sm" variant="ghost" icon={Copy} className="absolute top-2 right-2"
                  onClick={async () => { await navigator.clipboard.writeText(open.body!); toast({ tone: "success", title: "Webhook body copied" }); }}>Copy</Button>
                <pre className="max-h-[60vh] overflow-auto rounded-2xl bg-ink-50 p-4 text-xs text-ink-900">{open.body}</pre>
              </div>
            ) : (
              <p className="rounded-2xl bg-ink-50 p-4 text-ink-500">No body was kept for this webhook (it arrived before bodies were recorded, or it wasn&apos;t JSON).</p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
