"use client";

import { useState } from "react";
import { Gift } from "lucide-react";
import { useApi } from "@/shared/lib/api";
import { useSession } from "@/shared/lib/session";
import { date } from "@/shared/lib/format";
import { Badge, Card, EmptyState, ErrorState, KpiCard, PageHeader, Spinner, StatusBadge, Tabs } from "@/shared/ui/primitives";
import { DataTable, type Column } from "@/shared/ui/data";

type Data = {
  wishlists: { id: string; title: string; occasion: string; eventDate: string; visibility: string; createdAt: string; owner: string; items: number; fulfilled: number }[];
  campaigns: { id: string; reference: string; title: string; budgetMin: number; budgetMax: number; status: string; createdAt: string; deliveryCity: string; category: string; sender: string; quotes: number; overBudgetQuotes: number }[];
};

export default function WishlistsPage() {
  const { data, error, loading, reload } = useApi<Data>("/admin/wishlists");
  const [tab, setTab] = useState<"wishlists" | "campaigns">("wishlists");
  const { fmt } = useSession();
  if (loading) return <Spinner />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;
  const totalItems = data.wishlists.reduce((s, w) => s + w.items, 0);
  const gifted = data.wishlists.reduce((s, w) => s + w.fulfilled, 0);

  const wlCols: Column<Data["wishlists"][number]>[] = [
    { key: "t", header: "Wishlist", render: (w) => (<div><p className="font-semibold">{w.title}</p><p className="text-xs text-ink-500">{w.owner}</p></div>) },
    { key: "o", header: "Occasion", render: (w) => w.occasion ?? "—" },
    { key: "d", header: "Event date", render: (w) => date(w.eventDate) },
    { key: "v", header: "Visibility", render: (w) => <StatusBadge status={w.visibility} /> },
    { key: "i", header: "Gifted", align: "right", render: (w) => `${w.fulfilled} / ${w.items}` },
    { key: "c", header: "Created", hideOnMobile: true, render: (w) => date(w.createdAt) },
  ];
  const cCols: Column<Data["campaigns"][number]>[] = [
    { key: "t", header: "Surprise request", render: (c) => (<div><p className="font-semibold">{c.reference} · {c.title}</p><p className="text-xs text-ink-500">{c.sender} · {c.deliveryCity}</p></div>) },
    { key: "cat", header: "Category", render: (c) => c.category },
    { key: "b", header: "Sender budget", render: (c) => `${fmt(c.budgetMin)} – ${fmt(c.budgetMax)}` },
    { key: "q", header: "Vendor quotes", render: (c) => (<span>{c.quotes} {c.overBudgetQuotes > 0 && <Badge tone="warning">{c.overBudgetQuotes} over budget</Badge>}</span>) },
    { key: "s", header: "Status", render: (c) => <StatusBadge status={c.status} /> },
    { key: "d", header: "Created", hideOnMobile: true, render: (c) => date(c.createdAt) },
  ];

  return (
    <>
      <PageHeader title="Wishlists & Gift Campaigns" description="Recipient wishlists and sender-led surprise requests, where vendors quote within the sender's budget range." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard tint="plum" label="Wishlists" value={data.wishlists.length} />
        <KpiCard tint="gold" label="Public (opt-in)" value={data.wishlists.filter((w) => w.visibility === "Public").length} hint="Recipients explicitly chose discoverable" />
        <KpiCard tint="sage" label="Items gifted" value={`${gifted} / ${totalItems}`} />
        <KpiCard tint="lavender" label="Open surprise requests" value={data.campaigns.filter((c) => c.status === "Open" || c.status === "Quoted").length} />
      </div>
      <Card>
        <div className="border-b border-ink-100 p-4">
          <Tabs value={tab} onChange={setTab} tabs={[{ value: "wishlists", label: "Wishlists", count: data.wishlists.length }, { value: "campaigns", label: "Surprise requests", count: data.campaigns.length }]} />
        </div>
        {tab === "wishlists" ? (
          <DataTable caption="Wishlists" columns={wlCols} rows={data.wishlists} rowKey={(w) => w.id} empty={<EmptyState icon={Gift} title="No wishlists yet" />} />
        ) : (
          <DataTable caption="Surprise requests" columns={cCols} rows={data.campaigns} rowKey={(c) => c.id} empty={<EmptyState icon={Gift} title="No surprise requests" />} />
        )}
      </Card>
    </>
  );
}
