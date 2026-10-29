"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, Lock, MessageSquarePlus, ShieldCheck } from "lucide-react";
import { api, useApi, useMutation } from "@/shared/lib/api";
import { useSession } from "@/shared/lib/session";
import { date, dateTime } from "@/shared/lib/format";
import { Badge, Button, Card, CardHeader, cx, ErrorState, Notice, PageSkeleton, Stat, StatusBadge, Textarea } from "@/shared/ui/primitives";
import { ConfirmDialog, useToast } from "@/shared/ui/overlay";
import { Timeline } from "@/shared/ui/data";
import { OrderActionDialog, type OrderAction } from "@/shared/ui/order-actions";

type Detail = {
  id: string; reference: string; createdAt: string; status: string; paymentStatus: string; fraudHold: boolean;
  fulfilmentStatus: string; deliveryStatus: string; refundStatus: string;
  people: { senderName: string; senderEmail: string; recipientName: string; recipientPhone: string; deliveryAddress: string; deliveryCity: string; masked: boolean; maskReason?: string };
  vendor: { id: string; name: string; city: string };
  lines: { productName: string; emoji: string; quantity: number; unitPrice: number; customisation: string; total: number }[];
  money: { subtotal: number; deliveryFee: number; tax: number; discount: number; total: number; platformFee: number; vendorNet: number; fxRateNgn: number };
  gift: { giftMessage: string; personalisation: string; revealSender: boolean; discreetPackaging: boolean; hidePriceFromRecipient: boolean; budgetMin: number; budgetMax: number; viaWishlist: boolean };
  delivery: { deliveryOption: string; deliveryDate: string | null; trackingReference: string | null; courier: string | null; deliveryEvidence: string | null; deliveredAt: string | null };
  verification: { state: string; attempts: number; maxAttempts: number; expiresAt: string } | null;
  events: { id: string; at: string; title: string; detail: string; actor: string; internal: boolean }[];
  payments: { id: string; at: string; kind: string; amount: number; status: string; provider: string; providerReference: string; method: string; failureReason?: string }[];
  cases: { id: string; reference: string; type: string; status: string; reason: string; decision?: string }[];
  tickets: { id: string; reference: string; subject: string; status: string; priority: string }[];
  payout: { eligible: boolean; reason: string; reference?: string; status?: string; vendorNet: number };
  actions: OrderAction[];
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: fetched, error, loading, reload, setData } = useApi<Detail>(`/admin/orders/${id}`);
  const { fmt, persona } = useSession();
  const toast = useToast();
  const [action, setAction] = useState<OrderAction | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [note, setNote] = useState("");
  const reveal = useMutation((reason: string) => api<Detail>(`/admin/orders/${id}/reveal`, { method: "POST", body: { body: reason } }));
  const addNote = useMutation(() => api<Detail>(`/admin/orders/${id}/notes`, { method: "POST", body: { body: note } }));
  const [revealed, setRevealed] = useState<Detail["people"] | null>(null);

  if (loading) return <PageSkeleton />;
  if (error || !fetched) return <ErrorState error={error} onRetry={reload} />;
  const d = fetched;
  const people = revealed ?? d.people;

  return (
    <>
      <Link href="/orders" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-plum-700">
        <ArrowLeft className="size-4" aria-hidden /> Orders
      </Link>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-semibold text-plum-900">{d.reference}</h1>
            <StatusBadge status={d.status} />
            {d.fraudHold && <Badge tone="danger" icon={Lock}>Fraud hold</Badge>}
          </div>
          <p className="mt-1 text-sm text-ink-500">
            Placed {dateTime(d.createdAt)} · {d.gift.viaWishlist ? "Gifted from a wishlist" : "Surprise gift"} · Fulfilled by{" "}
            <Link className="font-semibold text-plum-700 hover:underline" href={`/vendors/${d.vendor.id}`}>
              {d.vendor.name}
            </Link>
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="text-ink-500">Payment</span> <StatusBadge status={d.paymentStatus} />
            <span className="ml-2 text-ink-500">Fulfilment</span> <StatusBadge status={d.fulfilmentStatus} />
            <span className="ml-2 text-ink-500">Delivery</span> <StatusBadge status={d.deliveryStatus} />
            {d.refundStatus !== "None" && (
              <>
                <span className="ml-2 text-ink-500">Refund</span> <StatusBadge status={d.refundStatus} />
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {d.actions.length === 0 && <p className="text-xs text-ink-400">No actions available for your role at this stage.</p>}
          {d.actions.map((a, i) => (
            <Button key={a.key} variant={i === 0 && !["cancel", "fraud-hold", "report-issue", "request-refund"].includes(a.key) ? "primary" : "secondary"} onClick={() => setAction(a)}>
              {a.label}
            </Button>
          ))}
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Items" />
            <ul className="divide-y divide-ink-100 px-5">
              {d.lines.map((l, i) => (
                <li key={i} className="flex items-center gap-4 py-4">
                  <span className="grid size-14 place-items-center rounded-xl bg-lavender-tint text-3xl" aria-hidden>
                    {l.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{l.productName}</p>
                    <p className="text-xs text-ink-500">
                      {l.quantity} × {fmt(l.unitPrice)}
                      {l.customisation && ` · ${l.customisation}`}
                    </p>
                  </div>
                  <p className="font-display text-lg font-semibold tabular">{fmt(l.total)}</p>
                </li>
              ))}
            </ul>
            <dl className="mx-5 mb-5 space-y-1.5 rounded-xl bg-ivory-100 p-4 text-sm">
              {[
                ["Subtotal", fmt(d.money.subtotal)],
                ["Delivery", fmt(d.money.deliveryFee)],
                ...(d.money.discount ? [["Discount", `−${fmt(d.money.discount)}`]] : []),
                ["VAT (7.5%, sample rate)", fmt(d.money.tax)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-ink-500">{k}</dt>
                  <dd className="tabular">{v}</dd>
                </div>
              ))}
              <div className="flex justify-between border-t border-ink-200 pt-2 font-semibold">
                <dt>Sender paid</dt>
                <dd className="tabular">{fmt(d.money.total)}</dd>
              </div>
              <div className="flex justify-between text-xs">
                <dt className="text-ink-500">SecretWish commission</dt>
                <dd className="tabular text-success-700">{fmt(d.money.platformFee)}</dd>
              </div>
              <div className="flex justify-between text-xs">
                <dt className="text-ink-500">Vendor net (subtotal + delivery − commission)</dt>
                <dd className="tabular">{fmt(d.money.vendorNet)}</dd>
              </div>
              <p className="pt-1 text-[11px] text-ink-400">Recorded FX: ₦{d.money.fxRateNgn.toLocaleString()} / $1</p>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Order timeline" description="Fulfilment events and internal notes" />
            <div className="px-5 pt-4 pb-5">
              <Timeline items={d.events.map((e) => ({ id: e.id, at: e.at, title: e.title, detail: e.detail, actor: e.actor, internal: e.internal }))} formatTime={dateTime} />
              <div className="mt-6 rounded-xl border border-dashed border-ink-200 p-3">
                <label htmlFor="note" className="text-xs font-semibold text-ink-700">
                  Add internal note <span className="font-normal text-ink-400">(visible to SecretWish staff only)</span>
                </label>
                <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5 min-h-[64px]" />
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    variant="subtle"
                    icon={MessageSquarePlus}
                    loading={addNote.pending}
                    disabled={note.trim().length < 2}
                    onClick={async () => {
                      const r = await addNote.run();
                      if (r) {
                        setData(r);
                        setNote("");
                        toast({ tone: "success", title: "Note added" });
                      }
                    }}
                  >
                    Add note
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Payment history" description="Provider references are sandbox / simulated" />
            <div className="overflow-x-auto px-2 pb-3">
              <table className="w-full min-w-[520px] text-left text-[13px]">
                <caption className="sr-only">Payments for this order</caption>
                <thead>
                  <tr className="text-xs text-ink-500">
                    <th className="px-3 py-2 font-semibold">When</th>
                    <th className="px-3 py-2 font-semibold">Type</th>
                    <th className="px-3 py-2 font-semibold">Provider ref</th>
                    <th className="px-3 py-2 text-right font-semibold">Amount</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {d.payments.map((p) => (
                    <tr key={p.id} className="border-t border-ink-100">
                      <td className="px-3 py-2">{dateTime(p.at)}</td>
                      <td className="px-3 py-2">
                        {p.kind} · {p.method}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{p.providerReference}</td>
                      <td className="px-3 py-2 text-right tabular">{fmt(p.amount)}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={p.status} />
                        {p.failureReason && <p className="mt-0.5 text-[11px] text-danger-700">{p.failureReason}</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="People"
              description={people.masked ? people.maskReason : "Full details visible for your role"}
              action={
                people.masked && persona.role !== "Finance" ? (
                  <Button size="sm" variant="secondary" icon={Eye} onClick={() => setRevealOpen(true)}>
                    Reveal
                  </Button>
                ) : revealed ? (
                  <Button size="sm" variant="ghost" icon={EyeOff} onClick={() => setRevealed(null)}>
                    Hide
                  </Button>
                ) : undefined
              }
            />
            <dl className="grid grid-cols-2 gap-4 p-5">
              <Stat label="Sender" value={people.senderName} />
              <Stat label="Sender email" value={<span className="break-all">{people.senderEmail}</span>} />
              <Stat label="Recipient" value={people.recipientName} />
              <Stat label="Recipient phone" value={people.recipientPhone} />
              <Stat className="col-span-2" label="Delivery address" value={people.deliveryAddress} />
            </dl>
            {revealed && <p className="px-5 pb-4 text-[11px] text-warning-700">Revealed for this session. The access and your reason were written to the audit log.</p>}
          </Card>

          <Card>
            <CardHeader title="Gift & privacy" />
            <dl className="grid grid-cols-2 gap-4 p-5">
              <Stat className="col-span-2" label="Gift message" value={d.gift.giftMessage ? `“${d.gift.giftMessage}”` : "—"} />
              <Stat label="Sender revealed?" value={d.gift.revealSender ? "Yes, after delivery" : "No — anonymous"} />
              <Stat label="Price hidden from recipient" value={d.gift.hidePriceFromRecipient ? "Yes" : "No"} />
              <Stat label="Discreet packaging" value={d.gift.discreetPackaging ? "Yes" : "No"} />
              {d.gift.budgetMax > 0 && <Stat label="Sender budget" value={`${fmt(d.gift.budgetMin)} – ${fmt(d.gift.budgetMax)}`} />}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Delivery" />
            <dl className="grid grid-cols-2 gap-4 p-5">
              <Stat label="Option" value={d.delivery.deliveryOption} />
              <Stat label="Promised by" value={date(d.delivery.deliveryDate)} />
              <Stat label="Courier" value={d.delivery.courier ?? "—"} />
              <Stat label="Tracking" value={<span className="font-mono text-xs">{d.delivery.trackingReference ?? "—"}</span>} />
              <Stat className="col-span-2" label="Delivery evidence" value={d.delivery.deliveryEvidence ?? "—"} />
              {d.verification && (
                <Stat
                  className="col-span-2"
                  label="Secret-code verification"
                  value={
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone={d.verification.state === "Used" ? "success" : d.verification.state === "Active" ? "plum" : "warning"} icon={ShieldCheck}>
                        {d.verification.state}
                      </Badge>
                      <span className="text-xs font-normal text-ink-500">
                        {d.verification.attempts}/{d.verification.maxAttempts} failed attempts · expires {dateTime(d.verification.expiresAt)}
                      </span>
                    </span>
                  }
                />
              )}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Vendor payout" />
            <div className="p-5">
              <div className={cx("rounded-xl p-3 text-sm", d.payout.eligible ? "bg-success-50 text-success-700" : "bg-ink-100 text-ink-700")}>
                <p className="font-semibold">{d.payout.reference ? `In payout ${d.payout.reference} (${d.payout.status})` : d.payout.eligible ? "Eligible for next payout" : "Not yet payable"}</p>
                <p className="text-xs">{d.payout.reason} · vendor net {fmt(d.payout.vendorNet)}</p>
              </div>
              <p className="mt-2 text-[11px] text-ink-400">Eligibility is evaluated by configurable rules: delivery evidence, hold period, open cases, fraud holds and payment state.</p>
            </div>
          </Card>

          {(d.cases.length > 0 || d.tickets.length > 0) && (
            <Card>
              <CardHeader title="Cases & support" />
              <ul className="space-y-2 p-5">
                {d.cases.map((c) => (
                  <li key={c.id}>
                    <Link href="/refunds" className="flex items-center justify-between gap-2 rounded-xl bg-ink-50 px-3 py-2 text-[13px] hover:bg-plum-50">
                      <span>
                        <b>{c.reference}</b> · {c.type} · {c.reason}
                      </span>
                      <StatusBadge status={c.status} />
                    </Link>
                  </li>
                ))}
                {d.tickets.map((t) => (
                  <li key={t.id}>
                    <Link href={`/support?ticket=${t.id}`} className="flex items-center justify-between gap-2 rounded-xl bg-ink-50 px-3 py-2 text-[13px] hover:bg-plum-50">
                      <span>
                        <b>{t.reference}</b> · {t.subject}
                      </span>
                      <StatusBadge status={t.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {d.status === "Dispatched" && persona.role === "OpsAdmin" && (
            <Notice tone="info" title="Vendors can't mark orders delivered">
              Delivery is confirmed by the recipient&apos;s secret code or by operations with courier evidence.
            </Notice>
          )}
        </div>
      </div>

      <OrderActionDialog action={action} basePath="/admin" orderId={d.id} onClose={() => setAction(null)} />
      <ConfirmDialog
        open={revealOpen}
        onClose={() => setRevealOpen(false)}
        title="Reveal personal details"
        description="Only reveal details you need to resolve this case. Your name, the time and your reason are recorded in the audit log."
        reasonLabel="Why do you need these details?"
        reasonPlaceholder="e.g. Recipient called about a missed delivery"
        confirmLabel="Reveal details"
        pending={reveal.pending}
        error={reveal.error?.message}
        onConfirm={async (reason) => {
          const r = await reveal.run(reason);
          if (r) {
            setRevealed(r.people);
            setRevealOpen(false);
          }
        }}
      />
    </>
  );
}
