"use client";

import { useState } from "react";
import { useApi } from "@/shared/lib/api";
import { useSession } from "@/shared/lib/session";
import { date, pct, shortDate } from "@/shared/lib/format";
import { Button, Card, CardHeader, ErrorState, Field, Input, KpiCard, Notice, PageHeader, PageSkeleton, SampleDataBadge } from "@/shared/ui/primitives";
import { BarsChart, ChartCard, chartColors, DonutChart, Legend } from "@/shared/ui/charts";

type Report = {
  from: string; to: string;
  metrics: Record<string, number>;
  weeks: { week: string; gmv: number; revenue: number; orders: number }[];
  categories: { category: string; orders: number; gmv: number }[];
  reconciliation: { status: string; count: number; amount: number }[];
  definitions: Record<string, string>;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function ReportsPage() {
  const today = new Date();
  const [from, setFrom] = useState(iso(new Date(today.getTime() - 89 * 864e5)));
  const [to, setTo] = useState(iso(today));
  const [applied, setApplied] = useState({ from, to });
  const invalid = from > to;
  const { data, error, loading, reload } = useApi<Report>(`/admin/reports?from=${applied.from}&to=${applied.to}`);
  const { fmt } = useSession();
  const preset = (days: number) => {
    const f = iso(new Date(today.getTime() - (days - 1) * 864e5));
    setFrom(f);
    setTo(iso(today));
    setApplied({ from: f, to: iso(today) });
  };

  const m = data?.metrics;
  const tiles: { key: string; label: string; value: (v: number) => string; tint: "plum" | "gold" | "sage" | "rose" | "lavender" | "ivory" }[] = [
    { key: "gmv", label: "Gross merchandise value", value: (v) => fmt(v), tint: "gold" },
    { key: "revenue", label: "Marketplace revenue", value: (v) => fmt(v), tint: "sage" },
    { key: "averageOrderValue", label: "Average order value", value: (v) => fmt(v), tint: "plum" },
    { key: "orderConversionRate", label: "Order conversion", value: (v) => pct(v), tint: "lavender" },
    { key: "repeatSenderRate", label: "Repeat sender rate", value: (v) => pct(v), tint: "plum" },
    { key: "wishlistToPurchase", label: "Wishlist → purchase", value: (v) => pct(v), tint: "gold" },
    { key: "avgFulfilmentHours", label: "Vendor fulfilment time", value: (v) => `${v}h`, tint: "ivory" },
    { key: "lateDeliveryRate", label: "Late delivery rate", value: (v) => pct(v), tint: "rose" },
    { key: "refundRate", label: "Refund rate", value: (v) => pct(v), tint: "rose" },
    { key: "disputeRate", label: "Dispute rate", value: (v) => pct(v), tint: "rose" },
    { key: "paymentFailureRate", label: "Payment failure rate", value: (v) => pct(v), tint: "rose" },
    { key: "supportResolutionHours", label: "Support resolution time", value: (v) => `${v}h`, tint: "lavender" },
  ];

  return (
    <>
      <PageHeader title="Reports & Analytics" description="Consistent definitions over one date range. Hover a metric or read the glossary below for its exact definition." actions={<SampleDataBadge />} />
      <Card className="mb-6">
        <form
          className="flex flex-wrap items-end gap-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!invalid) setApplied({ from, to });
          }}
        >
          <Field label="From" error={invalid ? "Start date must be before end date." : null}>
            {(id, d) => <Input id={id} aria-describedby={d} type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-44" />}
          </Field>
          <Field label="To">{(id) => <Input id={id} type="date" value={to} max={iso(today)} onChange={(e) => setTo(e.target.value)} className="w-44" />}</Field>
          <Button type="submit" disabled={invalid}>Apply</Button>
          <div className="flex gap-1">
            {[7, 30, 90].map((d) => (
              <Button key={d} type="button" variant="ghost" size="sm" onClick={() => preset(d)}>Last {d} days</Button>
            ))}
          </div>
        </form>
      </Card>
      {loading && <PageSkeleton />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && m && (
        <>
          <p className="mb-3 text-xs text-ink-500">
            Showing {date(data.from)} – {date(data.to)} · calculated from synthetic sample data, not production analytics.
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {tiles.map((t) => (
              <div key={t.key} title={data.definitions[t.key]}>
                <KpiCard tint={t.tint} label={t.label} value={t.value(m[t.key] ?? 0)} />
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <ChartCard
              title="Weekly GMV and revenue"
              summary={`${data.weeks.length} weeks. Highest GMV week: ${shortDate([...data.weeks].sort((a, b) => b.gmv - a.gmv)[0]?.week)}.`}
              table={{ headers: ["Week of", "Orders", "GMV", "Revenue"], rows: data.weeks.map((w) => [shortDate(w.week), w.orders, fmt(w.gmv), fmt(w.revenue)]) }}
              height={280}
            >
              <BarsChart data={data.weeks.map((w) => ({ ...w, label: shortDate(w.week) }))} x="label" series={[{ key: "gmv", label: "GMV" }, { key: "revenue", label: "Revenue", color: chartColors[1] }]} format={(v) => fmt(v, { compact: true })} />
            </ChartCard>
            <ChartCard
              title="Payout reconciliation"
              summary={data.reconciliation.map((r) => `${r.status}: ${r.count} (${fmt(r.amount)})`).join(", ")}
              table={{ headers: ["Status", "Payouts", "Net amount"], rows: data.reconciliation.map((r) => [r.status, r.count, fmt(r.amount)]) }}
              height={280}
            >
              <div className="flex h-full flex-col gap-3">
                <div className="h-40">
                  <DonutChart data={data.reconciliation.map((r, i) => ({ name: r.status, value: r.count, color: [chartColors[4], chartColors[3], "#b4443f"][i] }))} />
                </div>
                <Legend className="px-3" items={data.reconciliation.map((r, i) => ({ label: r.status, value: `${r.count} · ${fmt(r.amount)}`, color: [chartColors[4], chartColors[3], "#b4443f"][i] }))} />
              </div>
            </ChartCard>
          </div>
          <div className="mt-6">
            <ChartCard
              title="Popular gift categories"
              summary={`Top three: ${data.categories.slice(0, 3).map((c) => c.category).join(", ")}.`}
              table={{ headers: ["Category", "Orders", "GMV"], rows: data.categories.map((c) => [c.category, c.orders, fmt(c.gmv)]) }}
              height={300}
            >
              <BarsChart data={data.categories} x="category" layout="vertical" series={[{ key: "gmv", label: "GMV" }]} format={(v) => fmt(v, { compact: true })} />
            </ChartCard>
          </div>
          <Card className="mt-6">
            <CardHeader title="Metric definitions" />
            <dl className="grid gap-x-8 gap-y-3 p-5 md:grid-cols-2">
              {tiles.map((t) => (
                <div key={t.key}>
                  <dt className="text-sm font-semibold">{t.label}</dt>
                  <dd className="text-[13px] text-ink-500">{data.definitions[t.key]}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Notice className="mt-6" tone="neutral">Subscription income (monthly/yearly customer and vendor plans) is not yet modelled in these reports because price points are still to be confirmed.</Notice>
        </>
      )}
    </>
  );
}
