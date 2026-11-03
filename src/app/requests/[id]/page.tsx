"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Columns3, CreditCard, Handshake, Lock, Package, Sparkles, Star } from "lucide-react";
import { useState } from "react";
import { useApi } from "@/shared/lib/api";
import { useSession } from "@/shared/lib/session";
import { date, dateTime, moneyIn, timeAgo } from "@/shared/lib/format";
import { Badge, Button, ButtonLink, Card, CardHeader, cx, ErrorState, Notice, PageSkeleton, Stat, StatusBadge } from "@/shared/ui/primitives";
import { Modal } from "@/shared/ui/overlay";
import { Timeline } from "@/shared/ui/data";
import { InvoiceButton, InvoicePages, type Invoice } from "@/shared/ui/invoice";
import { Journey } from "../journey";

type QuoteRow = {
  id: string; description: string; priceUsd: number; overBudget: boolean; status: string; createdAt: string; invoice: Invoice | null;
  vendor: { id: string; name: string; city: string; rating: number; onTimeRate: number; acceptanceRate: number };
};
type Detail = {
  id: string; reference: string; title: string; status: string; createdAt: string; neededBy: string | null; notes: string; category: string;
  currency: string; budgetMin: number; budgetMax: number; budgetMinLocal: number; budgetMaxLocal: number; stage: string; step: number;
  items: { id: string; name: string; category: string; emoji: string; quantity: number; notes: string }[];
  wish: { title: string; url: string | null; imageUrl: string | null; estimatedPriceUsd: number | null } | null;
  sender: { id: string; name: string; email: string; phone: string; city: string; plan: string; memberSince: string; requests: number; ordersSent: number; masked: boolean };
  recipient: {
    name: string; phone: string | null; address: string | null; city: string; deliveryDate: string | null; viaWishlist: boolean;
    giftMessage: string | null; discreetPackaging: boolean | null; revealSender: boolean | null; collected: boolean; masked: boolean;
    email: string | null; onSecretWish: boolean; invitedAt: string | null;
  };
  quotes: QuoteRow[];
  chosen: { quoteId: string; vendor: { id: string; name: string; city: string }; priceUsd: number } | null;
  order: {
    id: string; reference: string; status: string; paymentStatus: string; createdAt: string; fraudHold: boolean; fulfilmentStatus: string; deliveryStatus: string;
    money: { subtotal: number; deliveryFee: number; tax: number; discount: number; total: number; platformFee: number; vendorNet: number };
    delivery: { deliveryOption: string; deliveryDate: string | null; trackingReference: string | null; courier: string | null; deliveryEvidence: string | null; deliveredAt: string | null };
  } | null;
  payment: {
    status: string; paid: number; refunded: number; total: number; paidAt: string | null;
    payments: { id: string; at: string; kind: string; amount: number; status: string; provider: string; providerReference: string; method: string; failureReason?: string }[];
  } | null;
  agreement: { state: "Not sent yet" | "Awaiting vendor" | "Accepted" | "Declined" | "Ended"; sentAt: string | null; acceptedAt: string | null; declinedAt: string | null; declineReason: string | null } | null;
  events: { id: string; at: string; title: string; detail: string; actor: string; internal: boolean }[];
};

type Tone = "neutral" | "success" | "warning" | "danger" | "plum";
const agreementTone: Record<string, Tone> = { "Not sent yet": "neutral", "Awaiting vendor": "warning", Accepted: "success", Declined: "danger", Ended: "neutral" };
const toneClass: Record<Tone, string> = {
  neutral: "border-ink-200 bg-white",
  plum: "border-plum-200 bg-plum-50/60",
  success: "border-success-600/30 bg-success-50/60",
  warning: "border-warning-600/30 bg-warning-50/60",
  danger: "border-danger-600/30 bg-danger-50/60",
};

/** One of the four "at a glance" tiles across the top. */
function Glance({ icon: Icon, label, value, detail, tone }: { icon: typeof Sparkles; label: string; value: string; detail?: string; tone: Tone }) {
  return (
    <div className={cx("rounded-2xl border p-4", toneClass[tone])}>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-500">
        <Icon className="size-3.5" aria-hidden /> {label}
      </p>
      <p className="mt-1 font-display text-lg font-semibold text-plum-900">{value}</p>
      {detail && <p className="text-xs text-ink-500">{detail}</p>}
    </div>
  );
}

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: d, error, loading, reload } = useApi<Detail>(`/admin/requests/${id}`);
  const { fmt } = useSession();
  const [comparing, setComparing] = useState(false);

  if (loading) return <PageSkeleton />;
  if (error || !d) return <ErrorState error={error} onRetry={reload} />;
  const budget = `${moneyIn(d.budgetMinLocal, d.currency)} – ${moneyIn(d.budgetMaxLocal, d.currency)}`;
  const lowest = d.quotes[0]?.priceUsd;

  const paymentGlance: { value: string; detail: string; tone: Tone } = !d.payment
    ? { value: "Not paid", detail: d.chosen ? "Vendor chosen, sender hasn't checked out" : "No vendor chosen yet", tone: "neutral" }
    : d.payment.status === "Succeeded"
      ? { value: `Paid ${fmt(d.payment.paid)}`, detail: d.payment.paidAt ? dateTime(d.payment.paidAt) : "", tone: "success" }
      : d.payment.status === "Pending"
        ? { value: "Awaiting payment", detail: `${fmt(d.payment.total)} due`, tone: "warning" }
        : d.payment.status === "Failed"
          ? { value: "Payment failed", detail: `${fmt(d.payment.total)} not collected`, tone: "danger" }
          : { value: d.payment.status === "Refunded" ? "Refunded" : "Partly refunded", detail: `${fmt(d.payment.refunded)} of ${fmt(d.payment.paid)} returned`, tone: "warning" };
  const agreement = d.agreement;
  const agreementDetail = !agreement
    ? d.chosen ? `${d.chosen.vendor.name} · after payment` : "Choose a vendor first"
    : agreement.state === "Accepted" ? `${d.chosen?.vendor.name ?? "Vendor"}${agreement.acceptedAt ? ` · ${dateTime(agreement.acceptedAt)}` : ""}`
      : agreement.state === "Awaiting vendor" ? `Sent ${timeAgo(agreement.sentAt)}`
        : agreement.state === "Declined" ? agreement.declineReason ?? ""
          : agreement.state === "Not sent yet" ? "Goes to the vendor once payment clears" : "";

  return (
    <>
      <Link href="/requests" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-plum-700">
        <ArrowLeft className="size-4" aria-hidden /> Requests
      </Link>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-semibold text-plum-900">{d.reference}</h1>
            <StatusBadge status={d.status} />
            {d.recipient.viaWishlist && <Badge tone="plum">From a wishlist</Badge>}
            {d.order?.fraudHold && <Badge tone="danger" icon={Lock}>Fraud hold</Badge>}
          </div>
          <p className="mt-1 text-lg font-semibold text-ink-900">{d.title}</p>
          <p className="text-sm text-ink-500">
            {d.category} · posted {dateTime(d.createdAt)}
            {d.neededBy && ` · needed by ${date(d.neededBy)}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <Journey step={d.step} stage={d.stage} />
          {d.order && <ButtonLink href={`/orders/${d.order.id}`} variant="secondary" size="sm" icon={ArrowUpRight}>Open order {d.order.reference}</ButtonLink>}
        </div>
      </header>

      <section aria-label="At a glance" className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Glance icon={Sparkles} label="Request" value={d.stage} detail={`${d.quotes.length} quote${d.quotes.length === 1 ? "" : "s"}${lowest != null ? ` · from ${fmt(lowest)}` : ""}`} tone={d.step < 0 ? "danger" : d.step === 6 ? "success" : "plum"} />
        <Glance icon={CreditCard} label="Sender payment" {...paymentGlance} />
        <Glance icon={Handshake} label="Vendor agreement" value={agreement?.state ?? "No vendor yet"} detail={agreementDetail} tone={agreement ? agreementTone[agreement.state] : "neutral"} />
        <Glance
          icon={Package}
          label="Delivery"
          value={d.order ? d.order.deliveryStatus : "Not started"}
          detail={d.order?.delivery.deliveredAt ? `Delivered ${dateTime(d.order.delivery.deliveredAt)}` : d.order?.delivery.trackingReference ? `${d.order.delivery.courier ?? "Courier"} · ${d.order.delivery.trackingReference}` : d.recipient.city}
          tone={d.order?.deliveryStatus === "Delivered" ? "success" : d.order?.deliveryStatus === "Exception" ? "danger" : "neutral"}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              title="Vendor quotes"
              description={`Cheapest first · sender's budget ${budget}${d.items.length > 1 ? ` for all ${d.items.length} items` : ""}`}
              action={d.quotes.length > 1 ? <Button size="sm" variant="secondary" icon={Columns3} onClick={() => setComparing(true)}>Compare side by side</Button> : undefined}
            />
            {d.quotes.length === 0 ? (
              <p className="m-5 rounded-xl bg-ink-50 px-4 py-3 text-sm text-ink-500">No vendor has quoted yet.</p>
            ) : (
              <ul className="grid gap-3 p-5 md:grid-cols-2">
                {d.quotes.map((q) => (
                  <li key={q.id} className={cx("flex flex-col rounded-2xl border p-4", q.status === "Accepted" ? "border-success-600/40 bg-success-50/50" : q.overBudget ? "border-warning-600/30 bg-warning-50/40" : "border-ink-200")}>
                    <QuoteSummary q={q} fmt={fmt} lowest={lowest} count={d.quotes.length} />
                    {q.description && <p className="mt-2 line-clamp-4 text-[13px] whitespace-pre-line text-ink-700">{q.description}</p>}
                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                      {q.invoice ? <InvoiceButton invoice={q.invoice} title={`${q.vendor.name}'s invoice`} /> : <span className="text-xs text-ink-400">No invoice attached</span>}
                      <span className="ml-auto text-[11px] text-ink-500">{timeAgo(q.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Chosen vendor progress"
              description={d.chosen ? `${d.chosen.vendor.name} · ${d.chosen.vendor.city} · quoted ${fmt(d.chosen.priceUsd)}` : "Appears once the sender picks a quote"}
              action={d.chosen ? <Link href={`/vendors/${d.chosen.vendor.id}`} className="text-xs font-semibold text-plum-700 hover:underline">View store</Link> : undefined}
            />
            {!d.order ? (
              <p className="m-5 rounded-xl bg-ink-50 px-4 py-3 text-sm text-ink-500">{d.chosen ? "The sender chose this vendor but hasn't checked out, so nothing has gone to the vendor yet." : "No vendor chosen yet."}</p>
            ) : (
              <div className="space-y-5 p-5">
                {agreement?.state === "Declined" && <Notice tone="danger" title="Vendor declined to deliver">{agreement.declineReason}</Notice>}
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Stat label="Agreement" value={<StatusBadge status={agreement?.state ?? "—"} />} />
                  <Stat label="Fulfilment" value={<StatusBadge status={d.order.fulfilmentStatus} />} />
                  <Stat label="Delivery" value={<StatusBadge status={d.order.deliveryStatus} />} />
                  <Stat label="Order status" value={<StatusBadge status={d.order.status} />} />
                  <Stat label="Delivery option" value={d.order.delivery.deliveryOption} />
                  <Stat label="Delivery date" value={d.order.delivery.deliveryDate ? date(d.order.delivery.deliveryDate) : "—"} />
                  <Stat label="Courier" value={d.order.delivery.courier ?? "—"} />
                  <Stat label="Tracking" value={d.order.delivery.trackingReference ?? "—"} />
                  {d.order.delivery.deliveryEvidence && <Stat className="col-span-2 sm:col-span-4" label="Proof of delivery" value={d.order.delivery.deliveryEvidence} />}
                </dl>
                {d.events.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-xs font-semibold text-ink-500">Timeline</h3>
                    <Timeline items={d.events.map((e) => ({ id: e.id, at: e.at, title: e.title, detail: e.detail, actor: e.actor, internal: e.internal }))} formatTime={dateTime} />
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Payment" description="Whether the sender has paid, and any refunds. Provider references are sandbox / simulated." />
            {!d.order || !d.payment ? (
              <p className="m-5 rounded-xl bg-ink-50 px-4 py-3 text-sm text-ink-500">No payment yet: the sender pays at checkout after choosing a quote.</p>
            ) : (
              <div className="space-y-4 p-5">
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Stat label="Status" value={<StatusBadge status={d.payment.status} />} />
                  <Stat label="Order total" value={fmt(d.order.money.total)} />
                  <Stat label="Paid" value={fmt(d.payment.paid)} />
                  <Stat label="Refunded" value={d.payment.refunded ? fmt(d.payment.refunded) : "—"} />
                  <Stat label="Platform fee" value={fmt(d.order.money.platformFee)} />
                  <Stat label="Vendor receives" value={fmt(d.order.money.vendorNet)} />
                </dl>
                {d.payment.payments.length > 0 && (
                  <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200 text-[13px]">
                    {d.payment.payments.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                        <span className="font-semibold text-ink-900">{p.kind}</span>
                        <span className="tabular">{fmt(p.amount)}</span>
                        <StatusBadge status={p.status} />
                        <span className="text-xs text-ink-500">{p.method} · {p.provider} · {p.providerReference}</span>
                        <span className="ml-auto text-xs text-ink-500">{dateTime(p.at)}</span>
                        {p.failureReason && <span className="w-full text-xs text-danger-700">{p.failureReason}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Sender" description={d.sender.masked ? "Masked for your role" : undefined} />
            <dl className="grid grid-cols-2 gap-4 p-5">
              <Stat label="Name" value={d.sender.name} />
              <Stat label="City" value={d.sender.city || "—"} />
              <Stat className="col-span-2" label="Email" value={<span className="break-all">{d.sender.email}</span>} />
              <Stat label="Phone" value={d.sender.phone || "—"} />
              <Stat label="Plan" value={d.sender.plan} />
              <Stat label="Surprise requests" value={d.sender.requests} />
              <Stat label="Paid orders" value={d.sender.ordersSent} />
              <Stat className="col-span-2" label="Member since" value={date(d.sender.memberSince)} />
            </dl>
          </Card>

          <Card>
            <CardHeader
              title="Recipient"
              description={!d.recipient.collected ? "Only first name and city until the sender checks out" : d.recipient.masked ? "Masked for your role. Reveal from the order (logged)." : undefined}
            />
            <dl className="grid grid-cols-2 gap-4 p-5">
              <Stat label="Name" value={d.recipient.name} />
              <Stat label="City" value={d.recipient.city} />
              <Stat className="col-span-2" label="Email" value={<span className="break-all">{d.recipient.email ?? "—"}</span>} />
              <Stat label="On SecretWish" value={d.recipient.onSecretWish || d.recipient.viaWishlist ? "Yes" : "No"} />
              <Stat label="Invited to join" value={d.recipient.invitedAt ? dateTime(d.recipient.invitedAt) : "—"} />
              {d.recipient.collected && (
                <>
                  <Stat label="Phone" value={d.recipient.phone || "—"} />
                  <Stat label="Delivery date" value={d.recipient.deliveryDate ? date(d.recipient.deliveryDate) : "—"} />
                  <Stat className="col-span-2" label="Delivery address" value={d.recipient.address || "—"} />
                  <Stat className="col-span-2" label="Gift message" value={d.recipient.giftMessage ? `“${d.recipient.giftMessage}”` : "—"} />
                  <Stat label="Sender revealed?" value={d.recipient.revealSender ? "Yes, after delivery" : "No — anonymous"} />
                  <Stat label="Discreet packaging" value={d.recipient.discreetPackaging ? "Yes" : "No"} />
                </>
              )}
            </dl>
          </Card>

          <Card>
            <CardHeader title="What they asked for" description={`Budget ${budget}${d.currency !== "USD" ? ` (≈ ${fmt(d.budgetMin)} – ${fmt(d.budgetMax)})` : ""}`} />
            <div className="space-y-3 p-5">
              {d.wish && (
                <div className="flex items-center gap-3 rounded-xl bg-plum-50 p-3 text-[13px]">
                  {d.wish.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.wish.imageUrl} alt="" referrerPolicy="no-referrer" className="size-14 shrink-0 rounded-lg object-cover" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-plum-900">Wishlist wish: {d.wish.title}</p>
                    {d.wish.url && <a href={d.wish.url} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-plum-700 underline">See the item</a>}
                    {d.wish.estimatedPriceUsd != null && <span className="text-ink-500"> · around {fmt(d.wish.estimatedPriceUsd)}</span>}
                  </div>
                </div>
              )}
              <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200 text-[13px]" aria-label="Items requested">
                {d.items.map((i) => (
                  <li key={i.id} className="flex items-start gap-2 px-3 py-2">
                    <span aria-hidden>{i.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold text-ink-900">{i.name}</span> <span className="text-ink-500">· {i.category}</span>
                      {i.notes && <span className="block text-xs text-ink-500">{i.notes}</span>}
                    </span>
                    <span className="text-xs text-ink-500 tabular">× {i.quantity}</span>
                  </li>
                ))}
              </ul>
              {d.notes && <p className="text-[13px] whitespace-pre-line text-ink-700">“{d.notes}”</p>}
            </div>
          </Card>
        </div>
      </div>

      <Modal open={comparing} onClose={() => setComparing(false)} title={`Compare quotes for ${d.reference}`} description={`Sender's budget: ${budget}`} size="2xl">
        <ul className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2" aria-label="Quotes side by side">
          {d.quotes.map((q) => (
            <li key={q.id} className="flex w-[85%] shrink-0 snap-start flex-col rounded-2xl border border-ink-200 sm:w-[calc(50%-0.375rem)] lg:w-[calc(33.333%-0.5rem)]">
              <div className="border-b border-ink-100 p-4">
                <QuoteSummary q={q} fmt={fmt} lowest={lowest} count={d.quotes.length} />
              </div>
              <div className="flex-1 space-y-3 p-4">
                {q.description && <p className="text-[13px] whitespace-pre-line text-ink-700">{q.description}</p>}
                {q.invoice ? (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold text-ink-500">Invoice · {q.invoice.fileName}</p>
                    <InvoicePages invoice={q.invoice} className="max-h-[60vh] overflow-y-auto" />
                  </div>
                ) : (
                  <p className="rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-500">No invoice attached.</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}

/** Vendor, rating, price and badges for one quote (shared by the list and the side-by-side view). */
function QuoteSummary({ q, fmt, lowest, count }: { q: QuoteRow; fmt: (usd: number) => string; lowest: number | undefined; count: number }) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/vendors/${q.vendor.id}`} className="text-sm font-semibold text-plum-700 hover:underline">{q.vendor.name}</Link>
          <p className="flex items-center gap-1 text-xs text-ink-500">
            <Star className="size-3 fill-gold-500 text-gold-500" aria-hidden /> {q.vendor.rating.toFixed(1)} · {q.vendor.city} · {Math.round(q.vendor.onTimeRate * 100)}% on time
          </p>
        </div>
        <span className="font-display text-xl font-semibold tabular">{fmt(q.priceUsd)}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <StatusBadge status={q.status} />
        {q.overBudget ? <Badge tone="warning">Outside budget</Badge> : <Badge tone="success">Within budget</Badge>}
        {count > 1 && q.priceUsd === lowest && <Badge tone="gold">Lowest price</Badge>}
      </div>
    </>
  );
}
