"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Copy, Mail, UserRound } from "lucide-react";
import { api, useApi, useMutation } from "@/shared/lib/api";
import { useSession } from "@/shared/lib/session";
import { useAccess } from "@/lib/access";
import { date, dateTime, pct } from "@/shared/lib/format";
import { Avatar, Button, Card, CardHeader, cx, ErrorState, KpiCard, Notice, PageSkeleton, ProductArt, StatusBadge } from "@/shared/ui/primitives";
import { ConfirmDialog, useToast } from "@/shared/ui/overlay";
import { KycReview, type Kyc } from "./kyc-review";

type Listing = { id: string; name: string; description?: string; category?: string; emoji: string; tint: string; images?: string[]; priceUsd: number; status: string; stock: number; reviewNote?: string };

type Detail = {
  vendor: { id: string; name: string; contactName: string; email: string; city: string; primaryCategory: string; description: string; status: string; businessVerified: boolean; bankVerified: boolean; idVerified: boolean; rating: number; acceptanceRate: number; avgFulfilmentHours: number; onTimeRate: number; plan: string; decisionReason?: string; appliedAt: string };
  /** The people who sign in to run this store. */
  accounts: { id: string; name: string; email: string | null; emailConfirmed: boolean; phone: string | null; createdAt: string }[];
  kyc: Kyc;
  products: Listing[];
  stats: { orders: number; gmv: number; delivered: number; exceptions: number; refunds: number };
  recentOrders: { id: string; reference: string; createdAt: string; status: string; total: number; product: string }[];
  payouts: { id: string; reference: string; net: number; status: string; createdAt: string; reconciliation: string }[];
  decisions: { id: string; at: string; actor: string; action: string; reason: string }[];
};

const decisionCopy: Record<string, { label: string; tone: "primary" | "danger" | "gold"; reason: string }> = {
  approve: { label: "Approve vendor", tone: "primary", reason: "Why are you approving this vendor?" },
  reject: { label: "Reject application", tone: "danger", reason: "Reason shared with the applicant" },
  suspend: { label: "Suspend vendor", tone: "danger", reason: "Reason for suspension" },
  reinstate: { label: "Reinstate vendor", tone: "gold", reason: "Why is it safe to reinstate?" },
};

export default function VendorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading, reload } = useApi<Detail>(`/admin/vendors/${id}`);
  const { fmt } = useSession();
  const { can } = useAccess();
  const toast = useToast();
  const [decision, setDecision] = useState<string | null>(null);
  const decide = useMutation((d: string, reason: string) => api(`/admin/vendors/${id}/decision`, { method: "POST", body: { decision: d, reason } }));
  const [review, setReview] = useState<{ product: Listing; decision: "approve" | "reject" | "suspend" } | null>(null);
  const reviewListing = useMutation((pid: string, d: string, reason: string) => api(`/admin/products/${pid}/review`, { method: "POST", body: { decision: d, reason } }));

  if (loading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;
  const v = data.vendor;
  const available = v.status === "Pending" ? ["approve", "reject"] : v.status === "Approved" ? ["suspend"] : v.status === "Suspended" ? ["reinstate"] : ["approve"];
  const canDecide = can("vendors.manage");
  const canReview = can("products.review");
  // Listings waiting for review first, so they can be approved here without the review queue.
  const listings = [...data.products].sort((a, b) => Number(b.status === "PendingReview") - Number(a.status === "PendingReview"));
  const pending = listings.filter((p) => p.status === "PendingReview").length;

  return (
    <>
      <Link href="/vendors" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-plum-700">
        <ArrowLeft className="size-4" aria-hidden /> Vendors
      </Link>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={v.name} size={56} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-3xl font-semibold text-plum-900">{v.name}</h1>
              <StatusBadge status={v.status} />
            </div>
            <p className="text-sm text-ink-500">
              {v.primaryCategory} · {v.city} · {v.contactName} · {v.plan} · applied {date(v.appliedAt)}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <a href={`mailto:${v.email}`} className="inline-flex items-center gap-1.5 font-semibold text-plum-700 hover:underline">
                <Mail className="size-4" aria-hidden /> {v.email}
              </a>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-plum-700"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(v.email);
                    toast({ tone: "success", title: "Email copied" });
                  } catch {
                    toast({ tone: "error", title: "Couldn't copy", body: v.email });
                  }
                }}
              >
                <Copy className="size-3.5" aria-hidden /> Copy
              </button>
            </p>
            {data.accounts.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs text-ink-500" aria-label="Accounts that sign in to this store">
                {data.accounts.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-1.5">
                    <UserRound className="size-3.5" aria-hidden /> Signs in as {a.name}
                    {a.email && (
                      <>
                        {" · "}
                        <a href={`mailto:${a.email}`} className="font-semibold text-plum-700 hover:underline">{a.email}</a>
                        {!a.emailConfirmed && <span className="text-warning-700">(not verified)</span>}
                      </>
                    )}
                    {a.phone && ` · ${a.phone}`}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {available.map((a) => (
            <Button key={a} variant={decisionCopy[a].tone === "danger" ? "secondary" : "primary"} disabled={!canDecide || (a === "approve" && !data.kyc.allVerified)} onClick={() => setDecision(a)}>
              {decisionCopy[a].label}
            </Button>
          ))}
        </div>
      </header>
      {!canDecide && <Notice className="mb-6">Your team role doesn&apos;t include approving or suspending vendors. You have read-only access.</Notice>}
      {available.includes("approve") && !data.kyc.allVerified && (
        <Notice tone="warning" className="mb-6" title="Can't approve yet">
          {data.kyc.readyForReview ? "Verify each check below before approving this store." : "The vendor hasn't sent all their verification documents yet. Approval unlocks once every check is verified."}
        </Notice>
      )}
      {v.status === "Approved" && !data.kyc.allVerified && (
        <Notice tone="warning" className="mb-6" title="Approved without verified KYC">
          This store was approved before verification was required. It has been asked to submit its documents from its Store page.
        </Notice>
      )}
      {v.decisionReason && (
        <Notice className="mb-6" tone={v.status === "Approved" ? "success" : "warning"} title="Latest decision reason">
          {v.decisionReason}
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard tint="plum" label="Orders" value={data.stats.orders} />
        <KpiCard tint="gold" label="GMV" value={fmt(data.stats.gmv)} />
        <KpiCard tint="sage" label="Acceptance rate" value={pct(v.acceptanceRate * 100, 0)} />
        <KpiCard tint="lavender" label="On-time delivery" value={pct(v.onTimeRate * 100, 0)} hint={`${v.avgFulfilmentHours}h avg. fulfilment`} />
        <KpiCard tint="rose" label="Exceptions / refunds" value={`${data.stats.exceptions} / ${data.stats.refunds}`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <KycReview vendorId={v.id} kyc={data.kyc} canReview={canDecide} onChanged={reload} />
          {v.description && (
            <Card className="p-5">
              <p className="text-xs font-semibold text-ink-500">About the store</p>
              <p className="mt-1 text-[13px] text-ink-700">{v.description}</p>
            </Card>
          )}
        </div>
        <Card>
          <CardHeader
            title={`Listings (${listings.length})`}
            description={pending > 0 ? `${pending} waiting for review. Check quality before they go live.` : "Review quality before products go live"}
            action={<Link href="/products" className="text-xs font-semibold text-plum-700 hover:underline">Review queue</Link>}
          />
          {listings.length === 0 && <p className="px-5 pb-5 text-sm text-ink-500">No listings yet.</p>}
          <ul className="grid gap-2 p-4 sm:grid-cols-2">
            {listings.map((p) => (
              <li key={p.id} className={cx("rounded-xl border p-2.5", p.status === "PendingReview" ? "border-gold-300 bg-gold-100/30" : "border-ink-100")}>
                <div className="flex items-center gap-3">
                  <ProductArt emoji={p.emoji} tint={p.tint} src={p.images?.[0]} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{p.name}</p>
                    <p className="text-xs text-ink-500">
                      {fmt(p.priceUsd)} · {p.stock} in stock{p.category && ` · ${p.category}`}
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                {p.description && <p className="mt-2 line-clamp-2 text-xs text-ink-700">{p.description}</p>}
                {p.reviewNote && <p className="mt-2 rounded-lg bg-warning-50 px-2 py-1 text-xs text-warning-700">{p.reviewNote}</p>}
                {canReview && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {p.status === "PendingReview" && (
                      <>
                        <Button size="sm" onClick={() => setReview({ product: p, decision: "approve" })}>Approve</Button>
                        <Button size="sm" variant="secondary" onClick={() => setReview({ product: p, decision: "reject" })}>Reject</Button>
                      </>
                    )}
                    {p.status === "Approved" && <Button size="sm" variant="ghost" onClick={() => setReview({ product: p, decision: "suspend" })}>Suspend listing</Button>}
                    {(p.status === "Suspended" || p.status === "Rejected") && <Button size="sm" variant="subtle" onClick={() => setReview({ product: p, decision: "approve" })}>Approve</Button>}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <ConfirmDialog
            open={!!review}
            onClose={() => { setReview(null); reviewListing.setError(null); }}
            title={review ? `${review.decision === "approve" ? "Approve" : review.decision === "reject" ? "Reject" : "Suspend"} “${review.product.name}”` : ""}
            tone={review?.decision === "approve" ? "primary" : "danger"}
            reasonLabel={review?.decision === "approve" ? undefined : "Feedback for the vendor"}
            description={review?.decision === "approve" ? (review.product.stock > 0 ? "The listing will be visible to senders and recipients immediately." : "It has no stock, so it will show as out of stock until the vendor adds some.") : "The vendor sees your feedback and is notified."}
            confirmLabel={review?.decision === "approve" ? "Approve listing" : review?.decision === "reject" ? "Reject listing" : "Suspend listing"}
            pending={reviewListing.pending}
            error={reviewListing.error?.message}
            onConfirm={async (reason) => {
              if (review && (await reviewListing.run(review.product.id, review.decision, reason)) !== undefined) {
                toast({ tone: "success", title: `Listing ${review.decision === "approve" ? "approved" : review.decision === "reject" ? "rejected" : "suspended"}`, body: "The vendor has been notified." });
                setReview(null);
                reload();
              }
            }}
          />
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Recent orders" />
          <ul className="divide-y divide-ink-100 px-5 pb-3">
            {data.recentOrders.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-2.5 text-[13px]">
                <Link href={`/orders/${o.id}`} className="font-semibold hover:text-plum-700">
                  {o.reference}
                  <span className="block text-xs font-normal text-ink-500">{o.product}</span>
                </Link>
                <StatusBadge status={o.status} />
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Payout history" />
          <ul className="divide-y divide-ink-100 px-5 pb-3">
            {data.payouts.length === 0 && <li className="py-6 text-sm text-ink-500">No payouts yet.</li>}
            {data.payouts.slice(0, 8).map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2.5 text-[13px]">
                <span>
                  <b>{p.reference}</b>
                  <span className="block text-xs text-ink-500">{date(p.createdAt)}</span>
                </span>
                <span className="text-right">
                  <span className="block font-semibold tabular">{fmt(p.net)}</span>
                  <StatusBadge status={p.status} />
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Decision history" description="From the audit log" />
          <ol className="space-y-3 px-5 pb-5">
            {data.decisions.length === 0 && <li className="text-sm text-ink-500">No decisions recorded.</li>}
            {data.decisions.map((a) => (
              <li key={a.id} className="text-[13px]">
                <p className="font-semibold">{a.action}</p>
                <p className="text-ink-700">{a.reason}</p>
                <p className="text-[11px] text-ink-400">
                  {a.actor} · {dateTime(a.at)}
                </p>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <ConfirmDialog
        open={!!decision}
        onClose={() => setDecision(null)}
        title={decision ? decisionCopy[decision].label : ""}
        tone={decision && decisionCopy[decision].tone === "danger" ? "danger" : "primary"}
        description={decision === "suspend" ? "Suspension hides all listings and blocks payouts until reinstated." : undefined}
        reasonLabel={decision ? decisionCopy[decision].reason : undefined}
        confirmLabel={decision ? decisionCopy[decision].label : "Confirm"}
        pending={decide.pending}
        error={decide.error?.message}
        onConfirm={async (reason) => {
          if (decision && (await decide.run(decision, reason)) !== undefined) {
            toast({ tone: "success", title: `${v.name}: ${decisionCopy[decision].label.toLowerCase()} — done`, body: "The vendor has been notified." });
            setDecision(null);
          }
        }}
      />
    </>
  );
}
