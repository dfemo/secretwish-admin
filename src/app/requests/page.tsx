"use client";

import Link from "next/link";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { usePagedApi } from "@/shared/lib/api";
import { PagedFooter } from "@/shared/ui/data";
import { useSession } from "@/shared/lib/session";
import { date, moneyIn, timeAgo } from "@/shared/lib/format";
import { Badge, Card, cx, EmptyState, ErrorState, PageHeader, SearchInput, Spinner, StatusBadge, Tabs } from "@/shared/ui/primitives";

type Row = {
  id: string; reference: string; title: string; status: string; createdAt: string; neededBy: string | null; deliveryCity: string;
  currency: string; budgetMin: number; budgetMax: number; budgetMinLocal: number; budgetMaxLocal: number;
  sender: string; recipient: string; viaWishlist: boolean;
  items: { id: string; name: string; emoji: string; quantity: number }[];
  quotes: { count: number; lowest: number | null; firstAt: string | null };
  vendor: { id: string; name: string; priceUsd: number } | null;
  order: { id: string; reference: string; status: string; paymentStatus: string; total: number; deliveredAt: string | null } | null;
  stage: string; step: number;
};

const steps = ["Requested", "Quoted", "Vendor chosen", "Paid", "Preparing", "Dispatched", "Delivered"];

/** Seven dots from request to delivery; a stopped request (closed, cancelled, refunded) is shown in red at the step it reached. */
function Journey({ step, stage }: { step: number; stage: string }) {
  const stopped = step < 0;
  return (
    <div className="min-w-[230px]">
      <ol className="flex items-center gap-1" aria-label={`Progress: ${stage}`}>
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-1" title={s}>
            <span className={cx("size-2.5 rounded-full", stopped ? "bg-danger-300" : i <= step ? "bg-plum-700" : "bg-ink-200", i === step && !stopped && "ring-4 ring-plum-100")} />
            {i < steps.length - 1 && <span className={cx("h-0.5 w-4", !stopped && i < step ? "bg-plum-700" : "bg-ink-200")} />}
          </li>
        ))}
      </ol>
      <p className={cx("mt-1.5 text-xs font-semibold", stopped ? "text-danger-700" : step === 6 ? "text-success-700" : "text-plum-800")}>{stage}</p>
    </div>
  );
}

export default function RequestsPage() {
  const [status, setStatus] = useState("");
  const { data: paged, items, error, loading, reload, setPage, search, setSearch } = usePagedApi<Row>("/admin/requests", { status }, 20);
  const { fmt } = useSession();
  const counts = paged?.counts ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader title="Requests" description="Every surprise request from the moment a sender posts it to delivery: quotes received, the vendor chosen, payment and fulfilment." />
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 p-4">
          <Tabs
            value={status}
            onChange={setStatus}
            tabs={[
              { value: "", label: "All", count: total },
              { value: "Open", label: "Waiting for quotes", count: counts.Open ?? 0 },
              { value: "Quoted", label: "Quoted", count: counts.Quoted ?? 0 },
              { value: "Accepted", label: "Vendor chosen", count: counts.Accepted ?? 0 },
              { value: "Closed", label: "Closed", count: counts.Closed ?? 0 },
            ]}
          />
          <SearchInput value={search} onChange={setSearch} label="Search requests" placeholder="Title, reference or sender" className="sm:w-72" />
        </div>
        {loading && !paged && <Spinner />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {items?.length === 0 && <EmptyState icon={Sparkles} title={search || status ? "No requests match" : "No surprise requests yet"} description="Requests appear here as soon as a sender posts one." />}
        <ul className="divide-y divide-ink-100">
          {items?.map((r) => (
            <li key={r.id} className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center">
              <div className="min-w-0">
                <p className="text-xs text-ink-500">
                  {r.reference} · {timeAgo(r.createdAt)} {r.viaWishlist && <Badge tone="plum">From a wishlist</Badge>}
                </p>
                <p className="truncate font-semibold text-plum-900">{r.title}</p>
                <p className="text-xs text-ink-500">
                  {r.sender} → {r.recipient} · {r.deliveryCity}
                  {r.neededBy && ` · needed by ${date(r.neededBy)}`}
                </p>
                <p className="mt-1 truncate text-xs text-ink-700">{r.items.map((i) => `${i.emoji} ${i.quantity > 1 ? `${i.quantity}× ` : ""}${i.name}`).join("  ·  ")}</p>
              </div>
              <div className="text-xs">
                <p className="font-semibold text-ink-900">{moneyIn(r.budgetMinLocal, r.currency)} – {moneyIn(r.budgetMaxLocal, r.currency)}</p>
                {r.currency !== "USD" && <p className="text-ink-500">≈ {fmt(r.budgetMin)} – {fmt(r.budgetMax)}</p>}
                <p className="mt-1 text-ink-500">
                  {r.quotes.count === 0 ? "No quotes yet" : `${r.quotes.count} quote${r.quotes.count === 1 ? "" : "s"} · from ${fmt(r.quotes.lowest)}`}
                </p>
              </div>
              <div className="text-xs">
                {r.vendor ? (
                  <>
                    <Link href={`/vendors/${r.vendor.id}`} className="font-semibold text-plum-700 hover:underline">{r.vendor.name}</Link>
                    <p className="text-ink-500">Chosen at {fmt(r.vendor.priceUsd)}</p>
                  </>
                ) : (
                  <p className="text-ink-400">No vendor chosen</p>
                )}
                {r.order && (
                  <p className="mt-1 flex flex-wrap items-center gap-1">
                    <Link href={`/orders/${r.order.id}`} className="font-semibold text-plum-700 hover:underline">{r.order.reference}</Link>
                    <StatusBadge status={r.order.paymentStatus} />
                  </p>
                )}
              </div>
              <Journey step={r.step} stage={r.stage} />
            </li>
          ))}
        </ul>
        <PagedFooter data={paged} onPage={setPage} className="border-t border-ink-100" />
      </Card>
    </>
  );
}
