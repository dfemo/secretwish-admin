"use client";

import Link from "next/link";
import { useState } from "react";
import { Trophy } from "lucide-react";
import { useApi } from "@/shared/lib/api";
import { date } from "@/shared/lib/format";
import { BarsChart, ChartCard, Legend, TrendChart } from "@/shared/ui/charts";
import { DataTable, type Column } from "@/shared/ui/data";
import { Card, CardHeader, EmptyState, ErrorState, PageHeader, Select, Spinner, Tabs } from "@/shared/ui/primitives";

type Kind = "senders" | "recipients" | "vendors";
type PersonRow = { rank: number; id: string; name: string; city: string | null; score: number; secondary: number };
type VendorRow = { rank: number; id: string; name: string; city: string; fulfilled: number; onTimePercent: number; rating: number };
type Board = { kind: Kind; total?: number; rows: (PersonRow | VendorRow)[] };
type Week = { start: string; giftOrders: number; cashGifts: number; fulfilled: number; senders: number; recipients: number; wishes: number };

// Two-hue pair from the brand ramps that passes the colour checks (lightness, chroma, colour-blind separation, contrast) in both modes.
const plum = "#8a5aa8";
const gold = "#b07d1e";

const copy: Record<Kind, { label: string; description: string }> = {
  senders: { label: "Senders", description: "Ranked by gifts sent: paid orders and cash gifts, not cancelled or refunded." },
  recipients: { label: "Recipients", description: "Ranked by gifts received; wishes asked for break ties." },
  vendors: { label: "Vendors", description: "Approved stores ranked by orders fulfilled (delivered, or handed to the SecretWish hub)." },
};

/** Staff leaderboards for senders, recipients and vendors (with names, masked by access level), and weekly activity trends. */
export default function LeaderboardsPage() {
  const [kind, setKind] = useState<Kind>("senders");
  const [period, setPeriod] = useState<"all" | "30d">("all");
  const [weeks, setWeeks] = useState(12);
  const board = useApi<Board>(`/admin/leaderboards?kind=${kind}&period=${period}&top=50`);
  const trends = useApi<Week[]>(`/admin/leaderboards/trends?weeks=${weeks}`);

  const person = (score: string, secondary?: string): Column<PersonRow>[] => [
    { key: "r", header: "#", render: (r) => <span className="font-bold tabular">{r.rank}</span> },
    { key: "n", header: "Name", render: (r) => (<div><p className="font-semibold">{r.name}</p>{r.city && <p className="text-xs text-ink-500">{r.city}</p>}</div>) },
    { key: "s", header: score, align: "right", render: (r) => <span className="font-semibold tabular">{r.score.toLocaleString()}</span> },
    ...(secondary ? [{ key: "x", header: secondary, align: "right" as const, render: (r: PersonRow) => <span className="tabular">{r.secondary.toLocaleString()}</span> }] : []),
  ];
  const vendorCols: Column<VendorRow>[] = [
    { key: "r", header: "#", render: (r) => <span className="font-bold tabular">{r.rank}</span> },
    { key: "n", header: "Store", render: (r) => (<div><Link href={`/vendors/${r.id}`} className="font-semibold text-plum-700 hover:underline">{r.name}</Link><p className="text-xs text-ink-500">{r.city}</p></div>) },
    { key: "f", header: "Fulfilled", align: "right", render: (r) => <span className="font-semibold tabular">{r.fulfilled.toLocaleString()}</span> },
    { key: "o", header: "On time", align: "right", render: (r) => <span className="tabular">{r.onTimePercent}%</span> },
    { key: "ra", header: "Rating", align: "right", hideOnMobile: true, render: (r) => <span className="tabular">{r.rating.toFixed(1)}</span> },
  ];

  const w = trends.data ?? [];
  const label = (s: string) => date(s).replace(/,? \d{4}$/, "");
  const series = w.map((x) => ({ ...x, week: label(x.start) }));
  const sum = (k: keyof Week) => w.reduce((n, x) => n + (x[k] as number), 0);
  const tableOf = (cols: [string, keyof Week][]) => ({ headers: ["Week of", ...cols.map((c) => c[0])], rows: w.map((x) => [date(x.start), ...cols.map((c) => x[c[1]] as number)]) });

  return (
    <>
      <PageHeader title="Leaderboards" description="Who's giving, receiving and fulfilling the most, and how activity is trending. Senders, recipients and vendors only ever see their own place." />

      <Card className="mb-8">
        <CardHeader
          title={`Top ${copy[kind].label.toLowerCase()}`}
          description={`${copy[kind].description}${board.data?.total ? ` ${board.data.total.toLocaleString()} on the board.` : ""}`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Tabs value={kind} onChange={setKind} tabs={(Object.keys(copy) as Kind[]).map((k) => ({ value: k, label: copy[k].label }))} />
              <label htmlFor="period" className="sr-only">Period</label>
              <Select id="period" value={period} onChange={(e) => setPeriod(e.target.value as "all" | "30d")} className="w-36">
                <option value="all">All time</option>
                <option value="30d">Last 30 days</option>
              </Select>
            </div>
          }
        />
        {board.loading && !board.data ? (
          <div className="p-6"><Spinner /></div>
        ) : board.error || !board.data ? (
          <ErrorState error={board.error} onRetry={board.reload} />
        ) : board.data.rows.length === 0 ? (
          <EmptyState icon={Trophy} title="Nobody on this board yet" />
        ) : board.data.kind === "vendors" ? (
          <DataTable caption="Top vendors" columns={vendorCols} rows={board.data.rows as VendorRow[]} rowKey={(r) => r.id} />
        ) : (
          <DataTable
            caption={`Top ${board.data.kind}`}
            columns={board.data.kind === "recipients" ? person("Received", "Wishes asked") : person("Gifts sent")}
            rows={board.data.rows as PersonRow[]}
            rowKey={(r) => r.id}
          />
        )}
      </Card>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold text-plum-900">Trends</h2>
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <span>Show</span>
          <Select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className="w-36" aria-label="Weeks to show">
            <option value={12}>12 weeks</option>
            <option value={26}>26 weeks</option>
            <option value={52}>52 weeks</option>
          </Select>
        </label>
      </div>
      {trends.loading && !trends.data ? (
        <Card className="p-6"><Spinner /></Card>
      ) : trends.error ? (
        <ErrorState error={trends.error} onRetry={trends.reload} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <ChartCard
            title="Gifts sent per week"
            description={<Legend className="mt-2 flex gap-4 space-y-0" items={[{ label: "Gift orders", color: plum, value: sum("giftOrders") }, { label: "Cash gifts", color: gold, value: sum("cashGifts") }]} />}
            summary={`${sum("giftOrders")} gift orders and ${sum("cashGifts")} cash gifts over ${weeks} weeks.`}
            table={tableOf([["Gift orders", "giftOrders"], ["Cash gifts", "cashGifts"]])}
          >
            <BarsChart data={series} x="week" stacked series={[{ key: "giftOrders", label: "Gift orders", color: plum }, { key: "cashGifts", label: "Cash gifts", color: gold }]} />
          </ChartCard>
          <ChartCard
            title="Orders fulfilled per week"
            description="Delivered, or handed to the SecretWish hub"
            summary={`${sum("fulfilled")} orders fulfilled over ${weeks} weeks.`}
            table={tableOf([["Fulfilled", "fulfilled"]])}
          >
            <TrendChart data={series} x="week" series={[{ key: "fulfilled", label: "Fulfilled", color: plum }]} />
          </ChartCard>
          <ChartCard
            title="Active people per week"
            description={<Legend className="mt-2 flex gap-4 space-y-0" items={[{ label: "Senders who gave", color: plum }, { label: "Recipients who received", color: gold }]} />}
            summary={`Distinct senders who gave and recipients who received each week, over ${weeks} weeks.`}
            table={tableOf([["Senders", "senders"], ["Recipients", "recipients"]])}
          >
            <TrendChart data={series} x="week" series={[{ key: "senders", label: "Senders", color: plum }, { key: "recipients", label: "Recipients", color: gold }]} />
          </ChartCard>
          <ChartCard
            title="Wishes added per week"
            description="Items recipients added to their wishlists"
            summary={`${sum("wishes")} wishes added over ${weeks} weeks.`}
            table={tableOf([["Wishes", "wishes"]])}
          >
            <TrendChart data={series} x="week" series={[{ key: "wishes", label: "Wishes", color: plum }]} />
          </ChartCard>
        </div>
      )}
    </>
  );
}
