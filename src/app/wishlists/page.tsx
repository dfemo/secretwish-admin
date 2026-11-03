"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Gift } from "lucide-react";
import { usePagedApi } from "@/shared/lib/api";
import { useSession } from "@/shared/lib/session";
import { date } from "@/shared/lib/format";
import { Badge, Card, EmptyState, ErrorState, KpiCard, PageHeader, SearchInput, Select, Spinner, StatusBadge, Tabs } from "@/shared/ui/primitives";
import { DataTable, PagedFooter, type Column } from "@/shared/ui/data";

type Wishlist = {
  id: string; title: string; occasion: string; eventDate: string; visibility: string; createdAt: string; owner: string; items: number; fulfilled: number;
  gifts: number; gifters: number; state: "Open" | "Fulfilled" | "Closed";
};
type Campaign = { id: string; reference: string; title: string; budgetMin: number; budgetMax: number; status: string; createdAt: string; deliveryCity: string; category: string; sender: string; quotes: number; overBudgetQuotes: number };

const n = (v: number | undefined) => (v === undefined ? "…" : v >= 10000 ? "10,000+" : v.toLocaleString());

export default function WishlistsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"wishlists" | "campaigns">("wishlists");
  const [state, setState] = useState("");
  const { data, error, loading, reload, setPage, search, setSearch } = usePagedApi<Wishlist & Campaign>("/admin/wishlists", { tab, state: tab === "wishlists" ? state : "" }, 25);
  const { fmt } = useSession();
  const c = data?.counts;

  const wlCols: Column<Wishlist>[] = [
    { key: "t", header: "Wishlist", render: (w) => (<div><p className="font-semibold">{w.title}</p><p className="text-xs text-ink-500">{w.owner}</p></div>) },
    { key: "o", header: "Occasion", render: (w) => w.occasion ?? "—" },
    { key: "d", header: "Event date", render: (w) => date(w.eventDate) },
    { key: "v", header: "Visibility", render: (w) => <StatusBadge status={w.visibility} /> },
    { key: "i", header: "Wishes gifted", align: "right", render: (w) => `${w.fulfilled} / ${w.items}` },
    { key: "g", header: "Gifts · gifters", align: "right", render: (w) => (<span>{w.gifts} · {w.gifters}{w.gifters > 1 && <Badge tone="plum" className="ml-1.5">Multiple</Badge>}</span>) },
    { key: "st", header: "State", render: (w) => <Badge tone={w.state === "Closed" ? "neutral" : w.state === "Fulfilled" ? "success" : "plum"}>{w.state}</Badge> },
    { key: "c", header: "Created", hideOnMobile: true, render: (w) => date(w.createdAt) },
  ];
  const cCols: Column<Campaign>[] = [
    { key: "t", header: "Surprise request", render: (r) => (<div><p className="font-semibold">{r.reference} · {r.title}</p><p className="text-xs text-ink-500">{r.sender} · {r.deliveryCity}</p></div>) },
    { key: "cat", header: "Category", render: (r) => r.category },
    { key: "b", header: "Sender budget", render: (r) => `${fmt(r.budgetMin)} – ${fmt(r.budgetMax)}` },
    { key: "q", header: "Vendor quotes", render: (r) => (<span>{r.quotes} {r.overBudgetQuotes > 0 && <Badge tone="warning">{r.overBudgetQuotes} over budget</Badge>}</span>) },
    { key: "s", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "d", header: "Created", hideOnMobile: true, render: (r) => date(r.createdAt) },
  ];

  return (
    <>
      <PageHeader title="Wishlists & Gift Campaigns" description="Recipient wishlists and sender-led surprise requests, where vendors quote within the sender's budget range." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard tint="plum" label="Wishlists" value={n(c?.wishlists)} />
        <KpiCard tint="gold" label="Public (opt-in)" value={n(c?.public)} hint="Recipients explicitly chose discoverable" />
        <KpiCard tint="sage" label="Items gifted" value={`${n(c?.gifted)} / ${n(c?.items)}`} />
        <KpiCard tint="lavender" label="Open surprise requests" value={n(c?.openCampaigns)} />
      </div>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 p-4">
          <Tabs value={tab} onChange={setTab} tabs={[{ value: "wishlists", label: "Wishlists", count: c?.wishlists }, { value: "campaigns", label: "Surprise requests", count: c?.campaigns }]} />
          <div className="flex flex-wrap items-center gap-2">
            {tab === "wishlists" && (
              <Select aria-label="State" value={state} onChange={(e) => setState(e.target.value)} className="w-40">
                <option value="">All lists</option>
                <option value="open">Open</option>
                <option value="closed">Closed{c?.closed != null ? ` (${n(c.closed)})` : ""}</option>
              </Select>
            )}
            <SearchInput value={search} onChange={setSearch} label="Search" placeholder={tab === "wishlists" ? "Title or owner" : "Title, reference or sender"} className="sm:w-72" />
          </div>
        </div>
        {loading && <Spinner />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {data &&
          (tab === "wishlists" ? (
            <DataTable caption="Wishlists" columns={wlCols} rows={data.items} rowKey={(w) => w.id} onRowClick={(w) => router.push(`/wishlists/${w.id}`)} rowLabel={(w) => `Open ${w.title}`} empty={<EmptyState icon={Gift} title={search ? "No wishlists match" : "No wishlists yet"} />} />
          ) : (
            <DataTable caption="Surprise requests" columns={cCols} rows={data.items} rowKey={(r) => r.id} onRowClick={(r) => router.push(`/requests/${r.id}`)} rowLabel={(r) => `Open ${r.reference}`} empty={<EmptyState icon={Gift} title={search ? "No requests match" : "No surprise requests"} />} />
          ))}
        <PagedFooter data={data} onPage={setPage} />
      </Card>
    </>
  );
}
