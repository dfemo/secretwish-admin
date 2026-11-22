"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Cake, LifeBuoy, MapPin, MessageSquare, Send } from "lucide-react";
import { api, ApiError, useApi, useMutation } from "../lib/api";
import { date, dateTime, timeAgo } from "../lib/format";
import { useSession } from "../lib/session";
import { Button, Card, CardHeader, EmptyState, ErrorState, Field, Input, Notice, Select, Spinner, StatusBadge, Switch, Textarea } from "./primitives";
import { useToast } from "./overlay";
import { BRAND } from "@/lib/brand";

type Prefs = { discreet: boolean; email: boolean; sms: boolean; push: boolean; orderUpdates: boolean; wishlistActivity: boolean; marketing: boolean };

/** Notification preferences, including discreet mode which hides gift details in previews. */
const profileCities = ["Lagos", "Abuja", "Port Harcourt", "Ibadan", "Enugu", "Kano"];
type MeDetails = { phone: string | null; city: string; address: string; dateOfBirth?: string | null };

/**
 * Your phone, city, delivery address and date of birth, the same for everyone whether they started as a sender or a recipient. The
 * date of birth can be added here once (for birthday wishes and birthday wishlists); after that only support can correct it.
 */
export function ProfileDetails({ description, notice }: { description: string; notice?: ReactNode }) {
  const { data: me, reload } = useApi<MeDetails>("/me");
  const { isDemo, reloadProfile } = useSession();
  const toast = useToast();
  const [form, setForm] = useState({ phone: "", city: "", address: "", dateOfBirth: "" });
  useEffect(() => {
    if (me) setForm({ phone: me.phone ?? "", city: me.city ?? "", address: me.address ?? "", dateOfBirth: me.dateOfBirth ?? "" });
  }, [me]);
  const dobSet = !!me?.dateOfBirth;
  // VeilWish (SecretWish) is 18+, so the picker stops at the latest date of birth that's old enough.
  const latest = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 18); return d.toISOString().slice(0, 10); })();
  const save = useMutation(() =>
    api("/me/profile", { method: "PUT", body: { phone: form.phone, city: form.city, address: form.address, dateOfBirth: dobSet ? null : form.dateOfBirth || null } }));
  const errors = save.error instanceof ApiError ? save.error.errors : undefined;
  const other = save.error && !errors ? save.error.message : null;

  return (
    <Card>
      <CardHeader title="Your details" description={description} />
      <form
        className="space-y-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if ((await save.run()) === undefined) return;
          toast({ tone: "success", title: "Details saved" });
          reload();
          if (!isDemo) await reloadProfile().catch(() => undefined);
        }}
      >
        {notice}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Phone number" required error={errors?.phone?.[0]}>
            {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors?.phone} type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+234 …" />}
          </Field>
          <Field label="City" required error={errors?.city?.[0]}>
            {(id) => (
              <Select id={id} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}>
                {!form.city && <option value="">Choose your city</option>}
                {profileCities.map((c) => <option key={c}>{c}</option>)}
                {form.city && !profileCities.includes(form.city) && <option>{form.city}</option>}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Delivery address" hint="Needed before anyone can send you a physical gift. Senders never see it." error={errors?.address?.[0]}>
          {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors?.address} autoComplete="street-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />}
        </Field>
        {dobSet ? (
          <div className="flex items-start gap-3 rounded-2xl bg-ink-50 p-3 text-sm">
            <Cake className="mt-0.5 size-4 shrink-0 text-plum-700" aria-hidden />
            <p><span className="font-semibold">Date of birth:</span> {date(me!.dateOfBirth!)}. We&apos;ll send you birthday wishes. If it&apos;s wrong, contact support to correct it.</p>
          </div>
        ) : (
          <Field label="Date of birth" hint="So we can send you birthday wishes and you can make a birthday wishlist. You must be 18 or older, and it can only be set once." error={errors?.dateOfBirth?.[0]}>
            {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors?.dateOfBirth} type="date" max={latest} autoComplete="bday" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />}
          </Field>
        )}
        {other && <Notice tone="danger">{other}</Notice>}
        <Button type="submit" icon={MapPin} loading={save.pending}>Save details</Button>
      </form>
    </Card>
  );
}

export function NotificationPreferences({ showWishlist = true }: { showWishlist?: boolean }) {
  const { data, error, reload } = useApi<Prefs>("/me/preferences");
  const [form, setForm] = useState<Prefs | null>(null);
  const toast = useToast();
  const save = useMutation((p: Prefs) => api("/me/preferences", { method: "PUT", body: p }));
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!form) return <Spinner />;
  const set = (k: keyof Prefs) => (v: boolean) => setForm({ ...form, [k]: v });
  return (
    <Card>
      <CardHeader title="Notifications" description={`Choose how ${BRAND} contacts you.`} />
      <div className="divide-y divide-ink-100 px-5 pb-5">
        <Switch checked={form.discreet} onChange={set("discreet")} label="Discreet notifications" description="Hide gift names, prices and people from subject lines, push and email previews." />
        <Switch checked={form.email} onChange={set("email")} label="Email" />
        <Switch checked={form.sms} onChange={set("sms")} label="SMS" />
        <Switch checked={form.push} onChange={set("push")} label="Push notifications" />
        <Switch checked={form.orderUpdates} onChange={set("orderUpdates")} label="Order & delivery updates" />
        {showWishlist && <Switch checked={form.wishlistActivity} onChange={set("wishlistActivity")} label="Wishlist activity" />}
        <Switch checked={form.marketing} onChange={set("marketing")} label="Offers & inspiration" description="Optional. Off by default." />
        <div className="flex items-center justify-between gap-3 pt-4">
          <p className="text-xs text-ink-400">Delivery channels are simulated in this prototype.</p>
          <Button
            loading={save.pending}
            onClick={async () => {
              if (await save.run(form)) toast({ tone: "success", title: "Preferences saved" });
            }}
          >
            Save preferences
          </Button>
        </div>
        {save.error && <p className="pt-2 text-sm text-danger-700">{save.error.message}</p>}
      </div>
    </Card>
  );
}

type Ticket = { id: string; reference: string; subject: string; category: string; status: string; createdAt: string; orderReference?: string; messages: { author: string; body: string; at: string }[] };

/** Customer- and vendor-facing support centre: raise tickets and read replies (internal notes never shown). */
export function SupportCenter({ orders }: { orders?: { id: string; reference: string; label: string }[] }) {
  const { data, error, loading, reload } = useApi<Ticket[]>("/me/tickets");
  const toast = useToast();
  const [form, setForm] = useState({ subject: "", description: "", category: "General", orderId: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useMutation(() => api<{ reference: string }>("/me/tickets", { method: "POST", body: { ...form, orderId: form.orderId || null } }));
  const [open, setOpen] = useState<string | null>(null);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!form.subject.trim()) e.subject = "Add a short subject.";
    if (form.description.trim().length < 10) e.description = "Tell us a little more (at least 10 characters).";
    setErrors(e);
    if (Object.keys(e).length) return;
    const r = await create.run();
    if (r) {
      toast({ tone: "success", title: `Ticket ${r.reference} created`, body: "Our team usually replies within a few hours." });
      setForm({ subject: "", description: "", category: "General", orderId: "" });
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <Card>
        <CardHeader title="Contact support" description="We keep every conversation private." />
        <div className="space-y-4 p-5">
          <Field label="What's it about?">
            {(id) => (
              <Select id={id} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="General">General question</option>
                <option value="LateDelivery">Late delivery</option>
                <option value="MissingGift">Missing gift</option>
                <option value="RefundRequest">Refund request</option>
                <option value="PrivacyComplaint">Privacy concern</option>
                <option value="Dispute">Problem with an item</option>
              </Select>
            )}
          </Field>
          {orders && orders.length > 0 && (
            <Field label="Related order" hint="Optional">
              {(id) => (
                <Select id={id} value={form.orderId} onChange={(e) => setForm({ ...form, orderId: e.target.value })}>
                  <option value="">Not about a specific order</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.reference} · {o.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <Field label="Subject" required error={errors.subject}>
            {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.subject} maxLength={120} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />}
          </Field>
          <Field label="Details" required error={errors.description}>
            {(id, d) => <Textarea id={id} aria-describedby={d} aria-invalid={!!errors.description} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}
          </Field>
          {create.error && <Notice tone="danger">{create.error.message}</Notice>}
          <Button icon={Send} loading={create.pending} onClick={submit} className="w-full">
            Send to support
          </Button>
        </div>
      </Card>
      <Card>
        <CardHeader title="Your conversations" />
        <div className="p-2">
          {loading && <Spinner />}
          {error && <ErrorState error={error} onRetry={reload} />}
          {data?.length === 0 && <EmptyState icon={LifeBuoy} title="No tickets yet" description="When you contact support, conversations appear here." />}
          <ul className="divide-y divide-ink-100">
            {data?.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => setOpen(open === t.id ? null : t.id)} aria-expanded={open === t.id} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-plum-50/50">
                  <MessageSquare className="size-4 shrink-0 text-plum-500" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{t.subject}</span>
                    <span className="text-xs text-ink-500">
                      {t.reference} · {timeAgo(t.createdAt)}
                      {t.orderReference && ` · ${t.orderReference}`}
                    </span>
                  </span>
                  <StatusBadge status={t.status} />
                </button>
                {open === t.id && (
                  <ol className="space-y-2 px-3 pb-4">
                    {t.messages.map((m, i) => (
                      <li key={i} className="rounded-xl bg-ink-50 px-3 py-2">
                        <p className="text-[11px] font-semibold text-ink-500">
                          {m.author} · {dateTime(m.at)}
                        </p>
                        <p className="text-[13px] text-ink-900">{m.body}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}
