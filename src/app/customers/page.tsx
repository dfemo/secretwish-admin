"use client";

import { useState } from "react";
import { Ban, ShieldCheck, Users } from "lucide-react";
import { api, useMutation, usePagedApi } from "@/shared/lib/api";
import { useAccess } from "@/lib/access";
import { ConfirmDialog, useToast } from "@/shared/ui/overlay";
import { useSession } from "@/shared/lib/session";
import { date } from "@/shared/lib/format";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Notice, PageHeader, SearchInput, Spinner, Tabs } from "@/shared/ui/primitives";
import { DataTable, type Column, PagedFooter } from "@/shared/ui/data";

type Customer = { id: string; name: string; email: string; phone: string; city: string; plan: string; usedFreeSample: boolean; createdAt: string; ordersSent: number; spend: number; giftsReceived: number; wishlists: number; masked: boolean;
  hasDateOfBirth: boolean; blacklisted: boolean; blacklistedAt: string | null; blacklistReason: string | null };

export default function CustomersPage() {
  const [type, setType] = useState<"sender" | "recipient">("sender");
  const { data: paged, items: data, error, loading, reload, setPage, search, setSearch } = usePagedApi<Customer>("/admin/customers", { type }, 25);
  const { fmt } = useSession();
  const { can } = useAccess();
  const toast = useToast();
  const [acting, setActing] = useState<Customer | null>(null);
  const act = useMutation((c: Customer, reason: string) => api(`/admin/customers/${c.id}/${c.blacklisted ? "unblacklist" : "blacklist"}`, { method: "POST", body: { body: reason } }));

  const columns: Column<Customer>[] = [
    {
      key: "name",
      header: "Name",
      render: (c) => (
        <div className="flex items-center gap-3">
          <Avatar name={c.name} size={32} />
          <div>
            <p className="font-semibold">
              {c.name} {c.blacklisted && <Badge tone="danger" icon={Ban} className="ml-1">Blacklisted</Badge>}
              {!c.hasDateOfBirth && <Badge tone="neutral" className="ml-1">No date of birth</Badge>}
            </p>
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
    ...(can("customers.manage")
      ? ([
          {
            key: "act",
            header: "",
            align: "right",
            render: (c) => (
              <Button size="sm" variant={c.blacklisted ? "secondary" : "ghost"} icon={c.blacklisted ? ShieldCheck : Ban} onClick={() => setActing(c)}>
                {c.blacklisted ? "Lift blacklist" : "Blacklist"}
              </Button>
            ),
          },
        ] as Column<Customer>[])
      : []),
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
      <ConfirmDialog
        open={!!acting}
        onClose={() => { setActing(null); act.setError(null); }}
        title={acting?.blacklisted ? `Lift the blacklist on ${acting.name}?` : `Blacklist ${acting?.name}?`}
        description={acting?.blacklisted
          ? `People will be able to gift to them again.${acting.blacklistReason ? ` Blacklisted for: ${acting.blacklistReason}` : ""}`
          : "Nobody will be able to gift to this person from any of their wishlists (including payments already started), their lists drop out of discovery, and they can't create new ones. They're notified."}
        confirmLabel={acting?.blacklisted ? "Lift blacklist" : "Blacklist customer"}
        tone={acting?.blacklisted ? "primary" : "danger"}
        reasonLabel={acting?.blacklisted ? undefined : "Why are you blacklisting them?"}
        pending={act.pending}
        error={act.error?.message}
        onConfirm={async (reason) => {
          if (acting && (await act.run(acting, reason)) !== undefined) {
            toast({ tone: "success", title: acting.blacklisted ? "Blacklist lifted" : "Customer blacklisted" });
            setActing(null);
            reload();
          }
        }}
      />
    </>
  );
}
