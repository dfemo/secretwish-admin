"use client";

import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { CalendarClock, Check, Crown, Receipt, X } from "lucide-react";
import { api, useApi, useMutation } from "../lib/api";
import { date, moneyIn } from "../lib/format";
import { useSession } from "../lib/session";
import { Badge, Button, ButtonLink, Card, cx, Skeleton } from "./primitives";
import { Modal, useToast } from "./overlay";

// Pricing plans as set by admins (api/plans/{audience}). Prices are in USD; each app shows them in its own currency.
export type PlanFeature = { id: string; text: string };
export type PricingPlan = {
  id: string;
  key: string;
  name: string;
  description: string;
  monthlyPriceUsd: number;
  yearlyPriceUsd: number;
  badge?: string | null;
  highlighted: boolean;
  active: boolean;
  isFree: boolean;
  /** Ids of the features this plan includes. */
  features: string[];
  /** How many accounts are on it (admin only). */
  accounts?: number | null;
};
export type PlanCatalog = { audience: "customer" | "vendor"; plans: PricingPlan[]; features: PlanFeature[] };
export type Billing = "Yearly" | "Monthly";

/** What an account stores for a plan: "Free", or "{key} Monthly" / "{key} Yearly". */
export const planCode = (p: PricingPlan, billing: Billing) => (p.isFree ? "Free" : `${p.key} ${billing}`);

/** Splits a stored plan ("Customer Yearly") into its key and billing period. */
export function parsePlanCode(code: string | null | undefined): { key: string; billing: Billing | null } {
  const [key = "", period] = (code ?? "").trim().split(" ");
  return { key, billing: period === "Monthly" || period === "Yearly" ? period : null };
}

/** How much cheaper a year is when billed yearly, as a whole percentage (0 when it isn't). */
export function yearlySaving(p: Pick<PricingPlan, "monthlyPriceUsd" | "yearlyPriceUsd">) {
  if (p.monthlyPriceUsd <= 0 || p.yearlyPriceUsd <= 0) return 0;
  return Math.max(0, Math.round((1 - p.yearlyPriceUsd / (p.monthlyPriceUsd * 12)) * 100));
}

/** The Annual / Monthly switch above the cards. */
export function BillingToggle({ value, onChange, className }: { value: Billing; onChange: (b: Billing) => void; className?: string }) {
  return (
    <div role="radiogroup" aria-label="Billing period" className={cx("inline-flex rounded-full border border-white/90 bg-white/80 p-1 shadow-[0_8px_24px_rgb(43_23_54/0.06)] backdrop-blur", className)}>
      {(["Yearly", "Monthly"] as const).map((b) => (
        <button
          key={b}
          type="button"
          role="radio"
          aria-checked={value === b}
          onClick={() => onChange(b)}
          className={cx("rounded-full px-5 py-2 text-sm font-medium transition", value === b ? "bg-plum-950 text-ivory-50 shadow-sm" : "text-ink-700 hover:text-ink-900")}
        >
          {b === "Yearly" ? "Annual" : "Monthly"}
        </button>
      ))}
    </div>
  );
}

type CardsProps = {
  catalog: Pick<PlanCatalog, "plans" | "features">;
  billing: Billing;
  /** Formats a USD amount in the viewer's currency. */
  format: (usd: number) => string;
  /** Shown after "/ month", e.g. "(USD)". */
  currencyNote?: string;
  /** The viewer's stored plan, e.g. "Customer Yearly": that card is marked Active. */
  current?: string | null;
  /** The call to action under each card; return null for none. */
  action?: (plan: PricingPlan, state: { current: boolean; code: string }) => ReactNode;
  className?: string;
};

/** Plan cards with a folder-tab label, the price for the chosen billing period and a tick/cross checklist of every feature. */
export function PricingCards({ catalog, billing, format: formatRaw, currencyNote, current, action, className }: CardsProps) {
  // Big prices read better without empty cents: $5.00 → $5 (but $9.58 stays).
  const format = (usd: number) => formatRaw(usd).replace(/[.,]00(?=\D*$)/, "");
  const mine = parsePlanCode(current);
  const count = catalog.plans.length;
  // Columns follow the space the cards actually have (a container query), so they fit beside a sidebar too.
  return (
    <div className="@container">
    <ul className={cx("grid gap-5", count >= 3 ? "@2xl:grid-cols-2 @5xl:grid-cols-3" : count === 2 ? "@2xl:mx-auto @2xl:max-w-4xl @2xl:grid-cols-2" : "mx-auto max-w-md", className)}>
      {catalog.plans.map((plan) => {
        const isCurrent = !!current && mine.key === plan.key && (plan.isFree || mine.billing === billing);
        return (
          <PlanCard
            key={plan.id}
            plan={plan}
            features={catalog.features}
            billing={billing}
            format={format}
            currencyNote={currencyNote}
            current={isCurrent}
            onOtherPeriod={!!current && mine.key === plan.key && !plan.isFree && mine.billing !== billing ? mine.billing : null}
          >
            {action?.(plan, { current: isCurrent, code: planCode(plan, billing) })}
          </PlanCard>
        );
      })}
    </ul>
    </div>
  );
}

function PlanCard({
  plan, features, billing, format, currencyNote, current, onOtherPeriod, children,
}: { plan: PricingPlan; features: PlanFeature[]; billing: Billing; format: (usd: number) => string; currencyNote?: string; current: boolean; onOtherPeriod: Billing | null; children?: ReactNode }) {
  const dark = plan.highlighted;
  const saving = yearlySaving(plan);
  const yearly = billing === "Yearly" && !plan.isFree;
  const perMonth = yearly ? plan.yearlyPriceUsd / 12 : plan.monthlyPriceUsd;
  // The corner tab: your plan first, then the saving on the featured plan, then the admin's badge, then any saving.
  const tab = current
    ? { text: "Active", dot: "bg-gold-400" }
    : dark && yearly && saving > 0
      ? { text: `Save ${saving}%`, dot: "bg-plum-950" }
      : plan.badge
        ? { text: plan.badge, dot: "bg-success-600" }
        : yearly && saving > 0
          ? { text: `Save ${saving}%`, dot: "bg-gold-500" }
          : null;
  const surface = dark ? "bg-plum-950" : "bg-white/75";
  const fillet = dark ? "var(--color-plum-950)" : "rgb(255 255 255 / 0.75)";

  return (
    <li
      className={cx(
        "relative flex flex-col rounded-[30px]",
        dark
          ? "bg-[repeating-linear-gradient(135deg,var(--color-gold-300)_0_2px,var(--color-gold-100)_2px_7px)] p-[3px] shadow-[0_30px_60px_rgb(43_23_54/0.22)]"
          : "shadow-[0_1px_2px_rgb(43_23_54/0.04),0_16px_40px_rgb(43_23_54/0.07)]",
      )}
    >
      {/* Folder tab: the card's left part rises; the label sits in the notch on the right. The tab's top-right corner (18px) and the
          curve down into the notch (22px) add up to the tab's 40px height, so they meet in one smooth S with no step between them. */}
      <div className="flex h-10">
        <div className={cx("relative flex-1 rounded-tl-[28px] rounded-tr-[18px]", surface, !dark && "backdrop-blur-md")}>
          <span aria-hidden className="absolute -right-[22px] bottom-0 size-[22px]" style={{ background: `radial-gradient(circle at 100% 0, transparent 21.5px, ${fillet} 22px)` }} />
        </div>
        <div className="flex w-[38%] items-center justify-center pl-6">
          {tab && (
            <span className={cx("inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap", dark ? "text-plum-950" : "text-ink-700")}>
              {tab.text}
              <span aria-hidden className={cx("size-1.5 rounded-full", tab.dot)} />
            </span>
          )}
        </div>
      </div>
      {/* Overlaps the tab row by 1px so no hairline shows between them at fractional zoom levels. */}
      <div className={cx("relative -mt-px flex flex-1 flex-col rounded-tr-[28px] rounded-b-[28px] px-6 pb-7", surface, dark ? "text-ivory-50" : "text-ink-900 backdrop-blur-md")}>
        <h3 className="-mt-4 text-center text-xl font-medium">{plan.name}</h3>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          {yearly && saving > 0 && (
            <span className={cx("text-4xl font-light tracking-tight line-through decoration-2 tabular sm:text-5xl", dark ? "text-plum-300" : "text-ink-300")}>
              {format(plan.monthlyPriceUsd)}
            </span>
          )}
          <span className={cx("text-4xl font-light tracking-tight tabular sm:text-5xl", dark && "text-gold-300")}>{format(perMonth)}</span>
          <span className={cx("text-left text-[13px] leading-snug whitespace-nowrap", dark ? "text-gold-300" : "text-ink-500")}>
            {plan.isFree ? <>free<br />forever</> : <>/ month{currencyNote ? ` ${currencyNote}` : ""}<br />{yearly ? `${format(plan.yearlyPriceUsd)} billed yearly` : "billed monthly"}</>}
          </span>
        </div>
        {plan.description && <p className={cx("mx-auto mt-5 max-w-xs text-center text-[13px] leading-relaxed", dark ? "text-plum-200" : "text-ink-500")}>{plan.description}</p>}
        <hr aria-hidden className={cx("my-6 border-0 border-t-2 border-dotted", dark ? "border-plum-700" : "border-ink-200")} />
        <ul className="flex-1 space-y-3">
          {features.map((f) => {
            const has = plan.features.includes(f.id);
            return (
              <li key={f.id} className={cx("flex items-center gap-3 text-[13px]", has ? (dark ? "text-ivory-50" : "text-ink-900") : dark ? "text-plum-400" : "text-ink-400")}>
                {has ? (
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-success-600 text-white">
                    <Check className="size-3.5" strokeWidth={3} aria-hidden />
                  </span>
                ) : (
                  <span className="grid size-6 shrink-0 place-items-center">
                    <X className="size-4" aria-hidden />
                  </span>
                )}
                <span>
                  {f.text}
                  <span className="sr-only">{has ? " (included)" : " (not included)"}</span>
                </span>
              </li>
            );
          })}
        </ul>
        {onOtherPeriod && <p className={cx("mt-5 text-center text-xs", dark ? "text-plum-200" : "text-ink-500")}>You&apos;re on this plan, billed {onOtherPeriod === "Yearly" ? "yearly" : "monthly"}.</p>}
        {children && <div className="mt-6 flex justify-center">{children}</div>}
      </div>
    </li>
  );
}

/** The pill button the reference uses under each card. */
export function PlanButton({ plan, children, ...rest }: { plan: PricingPlan; children: ReactNode } & Omit<ComponentProps<"button">, "children">) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        "inline-flex min-w-36 items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-medium shadow-sm transition disabled:cursor-default disabled:opacity-70",
        plan.highlighted ? "bg-white text-plum-950 hover:bg-ivory-100" : "bg-ivory-100 text-ink-900 hover:bg-ivory-200",
        rest.className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * Choosing a plan. A free plan switches straight away; a paid one goes to the default payment engine's checkout (Paystack,
 * Flutterwave or Stripe) and switches on once the payment is confirmed. `next` is the path to come back to after paying (the
 * current page if left out). `leaving` stays true while the browser heads to the checkout.
 */
export function usePlanChoice(audience: "customer" | "vendor") {
  const { currency } = useSession();
  const [leaving, setLeaving] = useState(false);
  const m = useMutation(async (code: string, free: boolean, next?: string) => {
    if (free) {
      await api(audience === "vendor" ? "/vendor/plan" : "/sender/plan", { method: "POST", body: { plan: code } });
      return { switched: true as const };
    }
    const back = next ?? `${window.location.pathname}${window.location.search}`;
    const r = await api<{ redirectUrl: string | null }>("/payments/plan", { method: "POST", body: { audience, plan: code, currency, next: back } });
    if (r.redirectUrl) {
      setLeaving(true);
      window.location.assign(r.redirectUrl);
    }
    return { switched: false as const };
  });
  return { choose: m.run, pending: m.pending || leaving, error: m.error };
}

/** A plan as its dashboard shows it (api/payments/plan). `blocked` lists the plan codes it can't move to until the term ends. */
export type PlanSummary = {
  plan: string; name: string; period: Billing | null; isFree: boolean; paidUntil: string | null; active: boolean; expired: boolean; daysLeft: number;
  lastPayment: { plan: string; currency: string; amount: number; amountUsd: number; provider: string; paidAt: string; reference: string } | null;
  blocked: Record<string, string>;
};

export function usePlanSummary(audience: "customer" | "vendor") {
  return useApi<PlanSummary>(`/payments/plan?audience=${audience}`);
}

/**
 * The paid plan on a dashboard: which plan, until when (and how many days are left), and the last payment in the currency it was
 * actually charged in. Free plans show a short nudge to compare plans instead.
 */
export function PlanSummaryCard({ audience, manageHref, onManage, className }: { audience: "customer" | "vendor"; manageHref?: string; onManage?: () => void; className?: string }) {
  const { data: s, loading } = usePlanSummary(audience);
  if (loading && !s) return <Skeleton className={cx("h-36 rounded-3xl", className)} />;
  if (!s) return null;
  const paid = !s.isFree;
  return (
    <Card className={cx("@container overflow-hidden", className)}>
      <div className={cx("flex flex-wrap items-center gap-x-4 gap-y-2 p-4 @md:p-5", paid ? "bg-plum-950 text-ivory-50" : "bg-ivory-50")}>
        <span className={cx("grid size-11 place-items-center rounded-2xl", paid ? "bg-gold-400 text-plum-950" : "bg-plum-100 text-plum-800")}>
          <Crown className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cx("text-xs font-semibold tracking-wide uppercase", paid ? "text-gold-300" : "text-ink-500")}>{audience === "vendor" ? "Store plan" : "Your plan"}</p>
          <p className="font-display text-xl font-semibold @md:text-2xl">
            {s.name}{s.period && <span className={cx("ml-2 inline-block text-sm font-normal @md:text-base", paid ? "text-plum-200" : "text-ink-500")}>billed {s.period === "Yearly" ? "yearly" : "monthly"}</span>}
          </p>
        </div>
        {s.active ? <Badge tone="success">Active</Badge> : s.expired ? <Badge tone="danger">Expired</Badge> : paid ? <Badge tone="neutral">Not paid</Badge> : <Badge tone="neutral">Free</Badge>}
      </div>
      <div className="grid gap-4 p-4 text-sm @md:p-5 @2xl:grid-cols-2">
        {paid && (
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-plum-700" aria-hidden />
            <div>
              <p className="font-semibold text-ink-900">{s.active ? `Active until ${date(s.paidUntil)}` : s.expired ? `Ended on ${date(s.paidUntil)}` : "No payment recorded for this plan"}</p>
              <p className="text-xs text-ink-500">
                {s.active ? `${s.daysLeft} ${s.daysLeft === 1 ? "day" : "days"} left. You can renew or upgrade any time; moving to a cheaper plan or Free waits until it ends.` : s.expired ? "Renew to keep your plan's benefits." : "Pay for it to make sure it stays active."}
              </p>
            </div>
          </div>
        )}
        {s.lastPayment ? (
          <div className="flex items-start gap-3">
            <Receipt className="mt-0.5 size-4 shrink-0 text-plum-700" aria-hidden />
            <div>
              <p className="font-semibold text-ink-900">
                {moneyIn(s.lastPayment.amount, s.lastPayment.currency)} paid in {s.lastPayment.currency}
              </p>
              <p className="text-xs break-words text-ink-500">
                {s.lastPayment.plan} · {date(s.lastPayment.paidAt)} with {s.lastPayment.provider}
                {s.lastPayment.currency !== "USD" && ` · ${moneyIn(s.lastPayment.amountUsd, "USD")} list price`} · ref {s.lastPayment.reference}
              </p>
            </div>
          </div>
        ) : !paid ? (
          <p className="text-ink-500 @2xl:col-span-2">{audience === "vendor" ? "Compare plans to grow your store." : "Upgrade for unlimited gifts, surprise requests and more wishlists."}</p>
        ) : null}
      </div>
      <div className="border-t border-ink-100 px-4 py-3 @md:px-5">
        {onManage ? (
          <Button size="sm" variant={paid && !s.expired ? "secondary" : "primary"} onClick={onManage}>{s.expired ? "Renew plan" : paid ? "Manage plan" : "Compare plans"}</Button>
        ) : (
          <ButtonLink href={manageHref ?? "#"} size="sm" variant={paid && !s.expired ? "secondary" : "primary"}>{s.expired ? "Renew plan" : paid ? "Manage plan" : "Compare plans"}</ButtonLink>
        )}
      </div>
    </Card>
  );
}

/**
 * Choosing a plan: the billing toggle and the plan cards, with the right button on each (pay, renew, switch to a free plan, or locked
 * until the current paid plan ends). A paid plan goes to the payment engine's checkout.
 */
export function PlanPicker({ audience, current, intro, next, onSwitched }: { audience: "customer" | "vendor"; current?: string; intro?: ReactNode; next?: string; onSwitched?: () => void }) {
  const { data: catalog } = useApi<PlanCatalog>(`/plans/${audience}`);
  const { fmt } = useSession();
  const toast = useToast();
  const change = usePlanChoice(audience);
  const summary = usePlanSummary(audience);
  const [billing, setBilling] = useState<Billing>("Yearly");
  // Open on the period the account pays for.
  useEffect(() => { const b = parsePlanCode(current).billing; if (b) setBilling(b); }, [current]);
  const blocked = summary.data?.blocked ?? {};
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[16rem] flex-1 text-sm text-ink-500">{intro ?? "Prices are set in USD and shown in your currency. Paid plans are paid securely with our payment partner."}</div>
        <BillingToggle value={billing} onChange={setBilling} />
      </div>
      {catalog ? (
        <PricingCards
          catalog={catalog}
          billing={billing}
          format={(usd) => fmt(usd)}
          current={current}
          action={(p, { current: isCurrent, code }) => (
            <PlanButton
              plan={p}
              disabled={(isCurrent && p.isFree) || change.pending || !!blocked[code]}
              title={blocked[code]}
              onClick={async () => {
                const r = await change.choose(code, p.isFree, next);
                if (r?.switched) { toast({ tone: "success", title: `Switched to ${p.name}` }); onSwitched?.(); }
              }}
            >
              {isCurrent ? (p.isFree ? "Your plan" : `Renew ${p.name}`) : blocked[code] ? "Available after your plan ends" : p.isFree ? `Switch to ${p.name}` : `Pay for ${p.name}`}
            </PlanButton>
          )}
        />
      ) : (
        <div className="grid gap-5 @2xl:grid-cols-2 @5xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[420px] rounded-[30px]" />)}</div>
      )}
      {change.error && <p role="alert" className="mt-4 text-center text-sm text-danger-700">{change.error.message}</p>}
    </div>
  );
}

/** The plan picker in a dialog (a sheet from the bottom on phones), so pages don't grow with every plan. */
export function PlansDialog({ open, onClose, audience, current, intro, next, onSwitched }: {
  open: boolean; onClose: () => void; audience: "customer" | "vendor"; current?: string; intro?: ReactNode; next?: string; onSwitched?: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} size="2xl" title={audience === "vendor" ? "Store plans" : "Plans"}
      description="Compare plans and choose the one that suits you.">
      <div className="@container">
        <PlanPicker audience={audience} current={current} intro={intro} next={next} onSwitched={() => { onSwitched?.(); onClose(); }} />
      </div>
    </Modal>
  );
}
