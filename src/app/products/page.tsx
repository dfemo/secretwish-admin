"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Boxes } from "lucide-react";
import { api, useApi, useMutation } from "@/shared/lib/api";
import { useSession } from "@/shared/lib/session";
import { Button, Card, CardHeader, EmptyState, ErrorState, PageHeader, ProductArt, SearchInput, Select, Spinner, StatusBadge, Tabs } from "@/shared/ui/primitives";
import { ConfirmDialog, useToast } from "@/shared/ui/overlay";

type Product = { id: string; name: string; description: string; priceUsd: number; stock: number; emoji: string; tint: string; status: string; reviewNote?: string; category: string; categoryId: string; deliveryOptions: string[]; vendor: { id: string; name: string } };

function ProductsInner() {
  const params = useSearchParams();
  const [status, setStatus] = useState(params.get("status") ?? "PendingReview");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const { fmt, meta, persona } = useSession();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<Product[]>(`/admin/products?status=${status}&search=${encodeURIComponent(search)}&categoryId=${category}`);
  const { data: all } = useApi<Product[]>(`/admin/products`);
  const [review, setReview] = useState<{ product: Product; decision: string } | null>(null);
  const run = useMutation((pid: string, decision: string, reason: string) => api(`/admin/products/${pid}/review`, { method: "POST", body: { decision, reason } }));
  const count = (s: string) => all?.filter((p) => p.status === s).length ?? 0;
  const canReview = persona.role === "OpsAdmin";

  return (
    <>
      <PageHeader title="Products & Categories" description="Listing quality control. Only approved listings from approved vendors appear to senders and recipients." />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5 lg:grid-cols-10">
        {meta?.categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(category === c.id ? "" : c.id)}
            aria-pressed={category === c.id}
            className={`rounded-2xl border p-3 text-center transition ${category === c.id ? "border-plum-400 bg-plum-50" : "border-ink-200/70 bg-white hover:border-plum-200"}`}
          >
            <span className="block text-2xl" aria-hidden>
              {c.emoji}
            </span>
            <span className="mt-1 block text-[11px] leading-tight font-semibold text-ink-700">{c.name}</span>
            <span className="text-[10px] text-ink-400">{all?.filter((p) => p.categoryId === c.id).length ?? 0} listings</span>
          </button>
        ))}
      </div>
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
          <Tabs
            value={status}
            onChange={setStatus}
            tabs={[
              { value: "PendingReview", label: "Review queue", count: count("PendingReview") },
              { value: "Approved", label: "Live", count: count("Approved") },
              { value: "OutOfStock", label: "Out of stock", count: count("OutOfStock") },
              { value: "Rejected", label: "Rejected", count: count("Rejected") },
              { value: "Suspended", label: "Suspended", count: count("Suspended") },
              { value: "Draft", label: "Drafts", count: count("Draft") },
            ]}
          />
          <SearchInput value={search} onChange={setSearch} label="Search products" placeholder="Product or vendor" className="min-w-[200px] flex-1" />
          <label htmlFor="cat" className="sr-only">
            Category
          </label>
          <Select id="cat" value={category} onChange={(e) => setCategory(e.target.value)} className="w-48">
            <option value="">All categories</option>
            {meta?.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        {loading && <Spinner />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {data?.length === 0 && <EmptyState icon={Boxes} title="Nothing here" description={status === "PendingReview" ? "The review queue is clear." : "No listings match."} />}
        <ul className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {data?.map((p) => (
            <li key={p.id}>
              <Card className="flex h-full flex-col overflow-hidden">
                <ProductArt emoji={p.emoji} tint={p.tint} size="xl" className="rounded-none" />
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{p.name}</h3>
                      <p className="text-xs text-ink-500">
                        {p.vendor.name} · {p.category}
                      </p>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="mt-2 line-clamp-2 text-[13px] text-ink-700">{p.description}</p>
                  <p className="mt-2 text-xs text-ink-500">
                    <b className="text-base text-ink-900">{fmt(p.priceUsd)}</b> · {p.stock} in stock · {p.deliveryOptions.join(", ")}
                  </p>
                  {p.reviewNote && <p className="mt-2 rounded-lg bg-warning-50 px-2 py-1 text-xs text-warning-700">{p.reviewNote}</p>}
                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    {p.status === "PendingReview" && (
                      <>
                        <Button size="sm" disabled={!canReview} onClick={() => setReview({ product: p, decision: "approve" })}>
                          Approve
                        </Button>
                        <Button size="sm" variant="secondary" disabled={!canReview} onClick={() => setReview({ product: p, decision: "reject" })}>
                          Reject
                        </Button>
                      </>
                    )}
                    {p.status === "Approved" && (
                      <Button size="sm" variant="secondary" disabled={!canReview} onClick={() => setReview({ product: p, decision: "suspend" })}>
                        Suspend listing
                      </Button>
                    )}
                    {(p.status === "Suspended" || p.status === "Rejected") && (
                      <Button size="sm" variant="subtle" disabled={!canReview} onClick={() => setReview({ product: p, decision: "approve" })}>
                        Approve
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </Card>
      <ConfirmDialog
        open={!!review}
        onClose={() => setReview(null)}
        title={review ? `${review.decision === "approve" ? "Approve" : review.decision === "reject" ? "Reject" : "Suspend"} “${review.product.name}”` : ""}
        tone={review?.decision === "approve" ? "primary" : "danger"}
        reasonLabel={review?.decision === "approve" ? undefined : "Feedback for the vendor"}
        description={review?.decision === "approve" ? "The listing will be visible to senders and recipients immediately." : undefined}
        confirmLabel="Confirm"
        pending={run.pending}
        error={run.error?.message}
        onConfirm={async (reason) => {
          if (review && (await run.run(review.product.id, review.decision, reason)) !== undefined) {
            toast({ tone: "success", title: "Listing updated", body: "The vendor has been notified." });
            setReview(null);
          }
        }}
      />
      {!canReview && <p className="mt-3 text-xs text-ink-500">Read-only: only operations admins can review listings.</p>}
    </>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ProductsInner />
    </Suspense>
  );
}
