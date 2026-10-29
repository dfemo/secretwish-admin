"use client";

import { useState } from "react";
import { FileClock } from "lucide-react";
import { useApi } from "@/shared/lib/api";
import { dateTime } from "@/shared/lib/format";
import { Badge, Card, EmptyState, ErrorState, PageHeader, SearchInput, Select, Spinner } from "@/shared/ui/primitives";
import { DataTable, type Column } from "@/shared/ui/data";

type Log = { id: string; at: string; actor: string; actorRole: string; action: string; entityType: string; entityRef: string; reason: string };

export default function AuditPage() {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const { data, error, loading, reload } = useApi<Log[]>(`/admin/audit?search=${encodeURIComponent(search)}&action=${action}`);
  const cols: Column<Log>[] = [
    { key: "at", header: "When", render: (l) => <span className="text-xs whitespace-nowrap">{dateTime(l.at)}</span> },
    { key: "actor", header: "Actor", render: (l) => (<div><p className="font-semibold">{l.actor}</p><p className="text-xs text-ink-500">{l.actorRole}</p></div>) },
    { key: "action", header: "Action", render: (l) => <Badge tone={l.action.includes("reject") || l.action.includes("suspend") || l.action.includes("locked") ? "danger" : l.action.includes("view_pii") ? "warning" : "plum"}>{l.action}</Badge> },
    { key: "entity", header: "Entity", render: (l) => (<span className="text-xs">{l.entityType} · <b>{l.entityRef}</b></span>) },
    { key: "reason", header: "Reason / detail", render: (l) => <span className="text-xs text-ink-700">{l.reason || "—"}</span> },
  ];
  return (
    <>
      <PageHeader title="Audit Logs" description="Append-only record of sensitive actions: decisions, reveals, refunds, payouts, settings and verification events." />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
          <SearchInput value={search} onChange={setSearch} label="Search audit log" placeholder="Actor, action or reference" className="min-w-[220px] flex-1" />
          <label htmlFor="act" className="sr-only">Action type</label>
          <Select id="act" value={action} onChange={(e) => setAction(e.target.value)} className="w-48">
            <option value="">All actions</option>
            <option value="order.">Orders</option>
            <option value="order.view_pii">Personal-data reveals</option>
            <option value="vendor.">Vendor decisions</option>
            <option value="product.">Listing reviews</option>
            <option value="case.">Refunds & disputes</option>
            <option value="payout.">Payouts</option>
            <option value="verification.">Verification</option>
            <option value="settings.">Settings</option>
          </Select>
        </div>
        {loading && <Spinner />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {data && <DataTable caption="Audit log" columns={cols} rows={data} rowKey={(l) => l.id} empty={<EmptyState icon={FileClock} title="No entries match" />} />}
      </Card>
    </>
  );
}
