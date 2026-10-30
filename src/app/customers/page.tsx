"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { useApi, usePagedApi } from "@/shared/lib/api";
import { useSession } from "@/shared/lib/session";
import { date } from "@/shared/lib/format";
import { Avatar, Badge, Card, EmptyState, ErrorState, Notice, PageHeader, SearchInput, Spinner, Tabs } from "@/shared/ui/primitives";
import { DataTable, type Column, PagedFooter } from "@/shared/ui/data";

type Customer = { id: string; name: string; email: string; phone: string; city: string; plan: string; usedFreeSample: boolean; createdAt: string; ordersSent: number; spend: number; giftsReceived: number; wishlists: number; masked: boolean };

export default function CustomersPage() {
  const [type, setType] = useState<"sender" | "recipient">("sender");
  const { data: paged, items: data, error, loading, reload, setPage, search, setSearch } = usePagedApi<Customer>("/admin/customers", { type }, 25);
  const { fmt } = useSession();

  const columns: Column<Customer>[] = [
    {
      key: "name",
      header: "Name",
      render: (c) => (
        <div className="flex items-center gap-3">
          <Avatar name={c.name} size={32} />
          <div>
            <p className="font-semibold">{c.name}</p>
            <p className="text-xs text-ink-500">{c.email}</p>
          </div>
        </div>
      ),
    },
    { key: "phone", header: "Phone", hideOnMobile: true, render: (c) => <span className="text-xs">{c.phone}</span> },
    { key: "city", header: "City", render: (c) => c.city },
    ...(type === "sender"
      ? ([
          { key: "plan", header: "Plan", render: (c) => <Badge tone={c.plan === "Free" ? "neutral" : "gold"}>{c.plan}</Badge> },
          { key: "sample", header: "Free sample", hideOnMobile: true, render: (c) => (c.usedFreeSample ? "Used" : "Available") },
          { key: "orders", header: "Gifts sent", align: "right", render: (c) => c.ordersSent },
          { key: "spend", header: "Spend", align: "right", render: (c) => fmt(c.spend) },
        ] as Column<Customer>[])
      : ([
          { key: "wl", header: "Wishlists", align: "right", render: (c) => c.wishlists },
          { key: "gifts", header: "Gifts received", align: "right", render: (c) => c.giftsReceived },
        ] as Column<Customer>[])),
    { key: "joined", header: "Joined", hideOnMobile: true, render: (c) => <span className="text-xs">{date(c.createdAt)}</span> },
  ];

  return (
    <>
      <PageHeader title="Customers & Recipients" description="Senders buy gifts; recipients keep wishlists. Contact details follow your role's privacy rules." />
      {data?.[0]?.masked && (
        <Notice className="mb-4" title="Masked for your role">
          Names, emails and phone numbers are partially hidden. Open a specific order and use “Reveal” with a reason if you need full details.
        </Notice>
      )}
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
          <Tabs
            value={type}
            onChange={setType}
            tabs={[
              { value: "sender", label: "Senders" },
              { value: "recipient", label: "Recipients" },
            ]}
          />
          <SearchInput value={search} onChange={setSearch} label="Search customers" placeholder="Name or city" className="min-w-[200px] flex-1" />
        </div>
        {loading && <Spinner />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {data && <DataTable caption={type === "sender" ? "Senders" : "Recipients"} columns={columns} rows={data} rowKey={(c) => c.id} empty={<EmptyState icon={Users} title="No matches" />} />}
        <PagedFooter data={paged} onPage={setPage} />
      </Card>
    </>
  );
}
