"use client";

import { Eye, KeyRound, Lock, ShieldCheck, UserCheck } from "lucide-react";
import { useApi } from "@/shared/lib/api";
import { dateTime } from "@/shared/lib/format";
import { Card, CardHeader, ErrorState, KpiCard, PageHeader, PageSkeleton } from "@/shared/ui/primitives";

type Data = {
  verifications: { active: number; used: number; expired: number; locked: number };
  wishlistVisibility: Record<string, number>;
  piiViews: { id: string; at: string; actor: string; actorRole: string; entityRef: string; reason: string }[];
  privacyTickets: number;
};

const controls = [
  { icon: UserCheck, title: "Role-based access", body: "Operations, Finance and Support see different levels of personal data. Masking is applied by the API, not the screen." },
  { icon: Eye, title: "Logged reveal", body: "Support must give a reason to reveal a sender or recipient's details; every reveal is written to the audit log." },
  { icon: Lock, title: "Wishlist consent", body: "Wishlists are private by default. Public discovery requires explicit confirmation, and share links can be rotated at any time." },
  { icon: KeyRound, title: "Secret-code verification", body: "Codes are random, salted and hashed server-side, single-use, expire after a configurable period, lock after repeated failures and are rate-limited per user." },
  { icon: ShieldCheck, title: "Surprise protection", body: "Recipients never see the item, price or sender until delivery — and the sender's identity only if they opt in. Discreet notifications hide gift details in previews." },
];

export default function PrivacyPage() {
  const { data, error, loading, reload } = useApi<Data>("/admin/privacy");
  if (loading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;
  return (
    <>
      <PageHeader title="Privacy & Security" description="How SecretWish protects senders, recipients and the surprise." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard tint="plum" label="Active verification codes" value={data.verifications.active} />
        <KpiCard tint="sage" label="Codes verified" value={data.verifications.used} />
        <KpiCard tint="ivory" label="Codes expired" value={data.verifications.expired} />
        <KpiCard tint="rose" label="Codes locked (abuse)" value={data.verifications.locked} />
        <KpiCard tint="gold" label="Open privacy tickets" value={data.privacyTickets} href="/support" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader title="Controls in place" description="Prototype implementation — see README for production hardening" />
          <ul className="grid gap-3 p-5 sm:grid-cols-2">
            {controls.map((c) => (
              <li key={c.title} className="rounded-2xl bg-ivory-100 p-4">
                <c.icon className="size-5 text-plum-600" aria-hidden />
                <p className="mt-2 text-sm font-semibold">{c.title}</p>
                <p className="mt-1 text-[13px] text-ink-700">{c.body}</p>
              </li>
            ))}
          </ul>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Wishlist visibility" description="Recipient-chosen" />
            <dl className="grid grid-cols-3 gap-3 p-5 text-center">
              {["Private", "Link", "Public"].map((k) => (
                <div key={k} className="rounded-xl bg-ink-50 p-3">
                  <dt className="text-xs text-ink-500">{k === "Link" ? "Link only" : k}</dt>
                  <dd className="text-2xl font-bold tabular">{data.wishlistVisibility[k] ?? 0}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card>
            <CardHeader title="Personal-data reveals" description="Who accessed unmasked details, and why" />
            <ul className="divide-y divide-ink-100 px-5 pb-3">
              {data.piiViews.length === 0 && <li className="py-6 text-sm text-ink-500">No reveals recorded.</li>}
              {data.piiViews.map((v) => (
                <li key={v.id} className="py-2.5 text-[13px]">
                  <p>
                    <b>{v.actor}</b> ({v.actorRole}) viewed <b>{v.entityRef}</b>
                  </p>
                  <p className="text-ink-500">“{v.reason}” · {dateTime(v.at)}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
      <Card className="mt-6">
        <CardHeader title="Questions for professional review before launch" description="This prototype makes no claim of legal or regulatory compliance." />
        <ul className="grid list-disc gap-2 py-5 pr-5 pl-10 text-[13px] text-ink-700 md:grid-cols-2">
          <li>Nigeria Data Protection Act 2023 / NDPC registration, lawful basis for processing recipient data supplied by senders, and data-processing agreements with vendors and couriers.</li>
          <li>Retention periods for orders, verification attempts, audit logs and support tickets; deletion and access-request workflows.</li>
          <li>Payment-services boundaries: whether a licensed provider&apos;s split/escrow product is required so SecretWish never holds customer funds (CBN guidance).</li>
          <li>Consumer protection (FCCPA) obligations for a managed marketplace: refunds, returns, delivery promises and liability between SecretWish and vendors.</li>
          <li>Vendor terms, KYB requirements and tax treatment of commission, VAT and subscriptions.</li>
          <li>If expanding to the UK: UK GDPR, Consumer Rights Act 2015 and FCA payment-services perimeter.</li>
        </ul>
      </Card>
    </>
  );
}
