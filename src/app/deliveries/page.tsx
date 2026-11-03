"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, Clock, Eye, EyeOff, MessageSquarePlus, Radar } from "lucide-react";
import { api, useMutation, usePagedApi } from "@/shared/lib/api";
import { date, dateTime } from "@/shared/lib/format";
import { DataTable, PagedFooter, type Column } from "@/shared/ui/data";
import { Badge, Button, Card, EmptyState, ErrorState, Field, Notice, PageHeader, SearchInput, Spinner, StatusBadge, Tabs, Textarea } from "@/shared/ui/primitives";
import { Modal, useToast } from "@/shared/ui/overlay";
import { useAccess } from "@/lib/access";

type Filter = "all" | "overdue" | "unchecked" | "mine" | "unassigned" | "exception";
type Delivery = {
  id: string; reference: string; status: string; deliveryDate: string | null; deliveryOption: string; deliveryCity: string; courier: string | null; trackingReference: string | null;
  dispatchedAt: string | null; vendor: { id: string; name: string }; destination: "SecretWish hub" | "Recipient";
  monitoredBy: string | null; lastCheckAt: string | null; lastCheckNote: string | null; overdue: boolean; needsCheck: boolean;
};

/** Every gift that's with a courier, so SecretWish agents can watch third-party deliveries: who's on it, when it was last checked,
 * and which are late or haven't been checked in a day. */
export default function DeliveriesPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const { data, items, error, loading, reload, setPage, search, setSearch } = usePagedApi<Delivery>("/admin/deliveries", { filter }, 25);
  const { can } = useAccess();
  const canManage = can("orders.manage");
  const toast = useToast();
  const [checking, setChecking] = useState<Delivery | null>(null);
  const [note, setNote] = useState("");
  const monitor = useMutation((id: string, body: { assign?: string; note?: string }) => api(`/admin/orders/${id}/monitor`, { method: "POST", body }));
  const c = data?.counts;

  const cols: Column<Delivery>[] = [
    {
      key: "r", header: "Order",
      render: (d) => (
        <div>
          <Link href={`/orders/${d.id}`} className="font-semibold text-plum-700 hover:underline">{d.reference}</Link>
          <p className="text-xs text-ink-500">{d.vendor.name} → {d.destination === "SecretWish hub" ? "SecretWish hub" : d.deliveryCity}</p>
        </div>
      ),
    },
    { key: "c", header: "Courier", render: (d) => (<div className="text-xs"><p className="font-semibold">{d.courier ?? "—"}</p><p className="text-ink-500">{d.trackingReference ?? "No tracking"}</p></div>) },
    { key: "s", header: "Status", render: (d) => <StatusBadge status={d.status} /> },
    { key: "d", header: "Left", hideOnMobile: true, render: (d) => <span className="text-xs whitespace-nowrap">{d.dispatchedAt ? dateTime(d.dispatchedAt) : "—"}</span> },
    {
      key: "due", header: "Due",
      render: (d) => (
        <span className="text-xs whitespace-nowrap">
          {d.deliveryDate ? date(d.deliveryDate) : "—"}
          {d.overdue && <Badge tone="danger" icon={AlertTriangle} className="ml-1">Late</Badge>}
        </span>
      ),
    },
    {
      key: "w", header: "Watched by",
      render: (d) => (
        <div className="max-w-56 text-xs">
          <p className="font-semibold">{d.monitoredBy ?? <span className="text-warning-700">Nobody yet</span>}</p>
          {d.lastCheckAt ? <p className="text-ink-500">{dateTime(d.lastCheckAt)}: {d.lastCheckNote}</p> : <p className="text-ink-400">Not checked yet</p>}
          {d.needsCheck && <Badge tone="warning" icon={Clock} className="mt-1">Check due</Badge>}
        </div>
      ),
    },
    {
      key: "a", header: "", align: "right",
      render: (d) =>
        canManage ? (
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="secondary" icon={MessageSquarePlus} onClick={() => { setNote(""); setChecking(d); }}>Log check</Button>
            {d.monitoredBy ? (
              <Button size="sm" variant="ghost" icon={EyeOff} aria-label="Stop watching" onClick={async () => { if ((await monitor.run(d.id, { assign: "none" })) !== undefined) reload(); }} />
            ) : (
              <Button size="sm" variant="ghost" icon={Eye} onClick={async () => { if ((await monitor.run(d.id, { assign: "me" })) !== undefined) { toast({ tone: "success", title: `You're watching ${d.reference}` }); reload(); } }}>Watch</Button>
            )}
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Courier monitoring"
        description="Gifts with a vendor's courier, on the way to the recipient or to the SecretWish hub. Watch each one, check in with the courier at least daily, and report problems early."
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: "all", label: "All", count: c?.all },
            { value: "overdue", label: "Late", count: c?.overdue },
            { value: "unchecked", label: "Check due", count: c?.unchecked },
            { value: "unassigned", label: "Nobody watching", count: c?.unassigned },
            { value: "mine", label: "Mine", count: c?.mine },
            { value: "exception", label: "Problems", count: c?.exception },
          ]}
        />
        <SearchInput value={search} onChange={setSearch} label="Search deliveries" placeholder="Reference, courier, tracking or vendor" className="w-72" />
      </div>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <Card className="p-6"><Spinner /></Card>
      ) : (
        <Card>
          <DataTable
            caption="Courier deliveries"
            columns={cols}
            rows={items ?? []}
            rowKey={(d) => d.id}
            empty={<EmptyState icon={Radar} title={filter === "all" ? "No gifts with couriers right now" : "Nothing here"} description="Dispatched gifts appear here until they're delivered or reach the hub." />}
          />
          <PagedFooter data={data} onPage={setPage} className="border-t border-ink-100" />
        </Card>
      )}
      {monitor.error && !checking && <Notice className="mt-4" tone="danger">{monitor.error.message}</Notice>}

      <Modal
        open={!!checking}
        onClose={() => { setChecking(null); monitor.setError(null); }}
        title={`Check on ${checking?.reference}`}
        description={checking ? `${checking.courier ?? "Courier"}${checking.trackingReference ? ` · ${checking.trackingReference}` : ""}. Saved to the order's internal timeline; you become its watcher if nobody is.` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setChecking(null)}>Cancel</Button>
            <Button
              disabled={note.trim().length < 3}
              loading={monitor.pending}
              onClick={async () => {
                if (checking && (await monitor.run(checking.id, { note })) !== undefined) {
                  toast({ tone: "success", title: "Check logged" });
                  setChecking(null);
                  reload();
                }
              }}
            >
              Save check
            </Button>
          </>
        }
      >
        <Field label="What did you find?" hint="e.g. Called GIG: with the rider, arriving by 4pm. Report a delay from the order page if it's stuck.">
          {(id, d) => <Textarea id={id} aria-describedby={d} rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
        {monitor.error && <Notice className="mt-3" tone="danger">{monitor.error.message}</Notice>}
      </Modal>
    </>
  );
}
