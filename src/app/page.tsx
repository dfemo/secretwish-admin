"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowRight, Banknote, CircleDollarSign, HandCoins, PackageOpen, RotateCcw, ShoppingBag, Store, TriangleAlert } from "lucide-react";
import { useApi } from "@/shared/lib/api";
import { useSession } from "@/shared/lib/session";
import { dateTime, humanize, pct, shortDate, timeAgo } from "@/shared/lib/format";
import { statusMeta } from "@/shared/lib/status";
import { Card, CardHeader, cx, ErrorState, KpiCard, PageHeader, PageSkeleton, SampleDataBadge, Select, StatusBadge } from "@/shared/ui/primitives";
import { BarsChart, ChartCard, chartColors, DonutChart, Legend, TrendChart } from "@/shared/ui/charts";

type Overview = {
  days: number;
  /** True while seeded sample people or stores are still in the database, so these figures include them. */
  sampleData: boolean;
  kpis: {
    totalOrders: number; totalOrdersDelta: number; gmv: number; gmvDelta: number; netRevenue: number; netRevenueDelta: number;
    vendorEarnings: number; refunded: number; taxCollected: number; requiringAttention: number; pendingFulfilment: number;
    activeVendors: number; openCases: number; payoutsProcessing: number; eligiblePayoutNet: number;
  };
  trend: { date: string; orders: number; gmv: number; revenue: number }[];
  statusDist: { status: string; count: number }[];
  categories: { category: string; orders: number; gmv: number }[];
  vendorPerf: { id: string; name: string; orders: number; gmv: number; acceptanceRate: number; onTimeRate: number; rating: number; avgFulfilmentHours: number }[];
  transactions: { id: string; at: string; kind: string; amount: number; status: string; providerReference: string; orderReference: string; orderId: string; method: string }[];
  activity: { at: string; title: string; detail: string; actor: string; orderReference: string; orderId: string }[];
  alerts: { severity: string; title: string; link: string }[];
};

export default function OverviewPage() {
  const [days, setDays] = useState(30);
  const { data, error, loading, reload } = useApi<Overview>(`/admin/overview?days=${days}`);
  const { fmt, persona } = useSession();

  if (loading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;
  const k = data.kpis;
  const trend = data.trend.map((t) => ({ ...t, label: shortDate(t.date) }));
  const peak = [...data.trend].sort((a, b) => b.gmv - a.gmv)[0];
  const totalStatus = data.statusDist.reduce((s, x) => s + x.count, 0);

  return (
    <>
      <PageHeader
        eyebrow={`Good day, ${persona.name.split(" ")[0]}`}
        title="Overview"
        description="Marketplace health at a glance. GMV, SecretWish revenue and vendor earnings are reported separately."
        actions={
          <>
            {data.sampleData && <SampleDataBadge />}
            <label className="sr-only" htmlFor="range">
              Date range
            </label>
            <Select id="range" value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-40">
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </Select>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <KpiCard tint="plum" icon={ShoppingBag} label="Total orders" value={k.totalOrders} delta={k.totalOrdersDelta} href="/orders" />
        <KpiCard tint="gold" icon={CircleDollarSign} label="Gross merchandise value" value={fmt(k.gmv)} delta={k.gmvDelta} hint="Subtotal + delivery, before refunds, excl. VAT" />
        <KpiCard tint="sage" icon={Banknote} label="Net marketplace revenue" value={fmt(k.netRevenue)} delta={k.netRevenueDelta} hint="SecretWish commission on kept orders" />
        <KpiCard tint="rose" icon={AlertTriangle} label="Orders requiring attention" value={k.requiringAttention} hint="SLA breaches, exceptions, refunds, holds" href="/orders?status=attention" />
        <KpiCard tint="lavender" icon={PackageOpen} label="Pending fulfilment" value={k.pendingFulfilment} hint="Awaiting vendor or processing" href="/orders?status=Processing" />
        <KpiCard tint="ivory" icon={Store} label="Active vendors" value={k.activeVendors} href="/vendors" />
        <KpiCard tint="rose" icon={RotateCcw} label="Open refunds & disputes" value={k.openCases} hint={`${fmt(k.refunded)} refunded this period`} href="/refunds" />
        <KpiCard tint="gold" icon={HandCoins} label="Payouts awaiting processing" value={fmt(k.eligiblePayoutNet)} hint={`${k.payoutsProcessing} batch(es) with provider`} href="/payouts" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <ChartCard
          title="Sales & orders"
          description={`GMV vs SecretWish revenue, last ${data.days} days`}
          summary={`GMV ${fmt(k.gmv)} and revenue ${fmt(k.netRevenue)} over ${data.days} days. Peak day ${peak ? shortDate(peak.date) : "—"} at ${fmt(peak?.gmv ?? 0)}.`}
          table={{ headers: ["Date", "Orders", "GMV", "Revenue"], rows: data.trend.map((t) => [shortDate(t.date), t.orders, fmt(t.gmv), fmt(t.revenue)]) }}
          height={280}
        >
          <TrendChart data={trend} x="label" series={[{ key: "gmv", label: "GMV" }, { key: "revenue", label: "Revenue", color: chartColors[1] }]} format={(v) => fmt(v, { compact: true })} />
        </ChartCard>

        <ChartCard
          title="Order status"
          description="Orders created in range"
          summary={data.statusDist.map((s) => `${statusMeta(s.status).label}: ${s.count}`).join(", ")}
          table={{ headers: ["Status", "Orders", "Share"], rows: data.statusDist.map((s) => [statusMeta(s.status).label, s.count, pct((s.count / Math.max(1, totalStatus)) * 100)]) }}
          height={280}
        >
          <div className="flex h-full flex-col gap-3">
            <div className="h-36">
              <DonutChart
                data={data.statusDist.map((s) => ({ name: statusMeta(s.status).label, value: s.count }))}
                center={
                  <div>
                    <div className="text-2xl font-bold text-ink-900 tabular">{totalStatus}</div>
                    <div className="text-[11px] text-ink-500">orders</div>
                  </div>
                }
              />
            </div>
            <Legend className="overflow-y-auto px-3" items={data.statusDist.map((s, i) => ({ label: statusMeta(s.status).label, value: s.count, color: chartColors[i % chartColors.length] }))} />
          </div>
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <ChartCard
          title="Popular gift categories"
          description="By GMV"
          summary={`Top category: ${data.categories[0]?.category ?? "—"} (${fmt(data.categories[0]?.gmv ?? 0)}).`}
          table={{ headers: ["Category", "Orders", "GMV"], rows: data.categories.map((c) => [c.category, c.orders, fmt(c.gmv)]) }}
          height={260}
        >
          <BarsChart data={data.categories} x="category" layout="vertical" series={[{ key: "gmv", label: "GMV" }]} format={(v) => fmt(v, { compact: true })} />
        </ChartCard>

        <Card>
          <CardHeader title="Vendor performance" description="Top vendors by GMV this period" action={<Link href="/vendors" className="text-xs font-semibold text-plum-700 hover:underline">All vendors</Link>} />
          <div className="overflow-x-auto px-2 pb-3">
            <table className="w-full min-w-[520px] text-left text-[13px]">
              <caption className="sr-only">Vendor performance</caption>
              <thead>
                <tr className="text-xs text-ink-500">
                  <th scope="col" className="px-3 py-2 font-semibold">Vendor</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Orders</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">GMV</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Acceptance</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">On-time</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Rating</th>
                </tr>
              </thead>
              <tbody>
                {data.vendorPerf.map((v) => (
                  <tr key={v.id} className="border-t border-ink-100">
                    <td className="px-3 py-2.5">
                      <Link href={`/vendors/${v.id}`} className="font-semibold text-ink-900 hover:text-plum-700">
                        {v.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular">{v.orders}</td>
                    <td className="px-3 py-2.5 text-right tabular">{fmt(v.gmv)}</td>
                    <td className={cx("px-3 py-2.5 text-right tabular", v.acceptanceRate < 0.9 && "font-semibold text-warning-700")}>{pct(v.acceptanceRate * 100, 0)}</td>
                    <td className={cx("px-3 py-2.5 text-right tabular", v.onTimeRate < 0.9 && "font-semibold text-warning-700")}>{pct(v.onTimeRate * 100, 0)}</td>
                    <td className="px-3 py-2.5 text-right tabular">★ {v.rating.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Alerts & exceptions" description="Things that need a human" />
          <ul className="space-y-2 p-4">
            {data.alerts.length === 0 && <li className="text-sm text-ink-500">No open alerts. 🎉</li>}
            {data.alerts.map((a) => (
              <li key={a.title}>
                <Link href={a.link} className={cx("flex items-start gap-3 rounded-xl px-3 py-2.5 text-[13px] ring-1 ring-inset hover:shadow-sm", a.severity === "high" ? "bg-danger-50 ring-danger-600/15" : a.severity === "medium" ? "bg-warning-50 ring-warning-600/15" : "bg-plum-50 ring-plum-200")}>
                  <TriangleAlert className={cx("mt-0.5 size-4 shrink-0", a.severity === "high" ? "text-danger-600" : a.severity === "medium" ? "text-warning-600" : "text-plum-600")} aria-hidden />
                  <span className="flex-1 font-medium text-ink-900">
                    <span className="sr-only">{a.severity} severity: </span>
                    {a.title}
                  </span>
                  <ArrowRight className="mt-0.5 size-4 text-ink-400" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Recent transactions" description="Payment provider: sandbox / simulated" action={<Link href="/payments" className="text-xs font-semibold text-plum-700 hover:underline">View all</Link>} />
          <ul className="divide-y divide-ink-100 px-5 pb-3">
            {data.transactions.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <Link href={`/orders/${t.orderId}`} className="text-[13px] font-semibold hover:text-plum-700">
                    {t.kind} · {t.orderReference}
                  </Link>
                  <p className="text-[11px] text-ink-500">
                    {t.method} · {timeAgo(t.at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className={cx("text-[13px] font-semibold tabular", t.kind === "Refund" && "text-danger-700")}>
                    {t.kind === "Refund" ? "−" : ""}
                    {fmt(t.amount)}
                  </p>
                  <StatusBadge status={t.status} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Operational activity" description="Latest order events" />
          <ol className="space-y-3 px-5 pb-5">
            {data.activity.map((a, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-gold-500" aria-hidden />
                <div className="min-w-0">
                  <p className="text-[13px]">
                    <span className="font-semibold">{humanize(a.title)}</span> ·{" "}
                    <Link href={`/orders/${a.orderId}`} className="text-plum-700 hover:underline">
                      {a.orderReference}
                    </Link>
                  </p>
                  <p className="truncate text-xs text-ink-500">{a.detail}</p>
                  <p className="text-[11px] text-ink-400">
                    {a.actor} · {dateTime(a.at)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  );
}
