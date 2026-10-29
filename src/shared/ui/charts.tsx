"use client";

import { useState, type ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Table2, BarChart3 } from "lucide-react";
import { Card, CardHeader, cx } from "./primitives";

export const chartColors = ["#3b1f4a", "#c9a45c", "#9c7ab0", "#2f7d55", "#d8b874", "#643a7b", "#bba3cb", "#a86400"];

/**
 * Chart wrapper with a written summary (read by screen readers and shown to everyone)
 * and a "view as table" toggle so data is never locked inside a graphic.
 */
export function ChartCard({
  title,
  description,
  summary,
  table,
  action,
  children,
  className,
  height = 260,
}: {
  title: string;
  description?: ReactNode;
  summary: string;
  table: { headers: string[]; rows: (string | number)[][] };
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  height?: number;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <Card className={className}>
      <CardHeader
        title={title}
        description={description}
        action={
          <div className="flex items-center gap-2">
            {action}
            <button
              type="button"
              onClick={() => setAsTable((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-ink-500 hover:bg-ink-100 hover:text-ink-900"
              aria-pressed={asTable}
            >
              {asTable ? <BarChart3 className="size-3.5" aria-hidden /> : <Table2 className="size-3.5" aria-hidden />}
              {asTable ? "Chart" : "Table"}
            </button>
          </div>
        }
      />
      <figure className="px-3 pt-2 pb-4">
        {asTable ? (
          <div className="max-h-[300px] overflow-auto px-2">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-xs text-ink-500">
                  {table.headers.map((h) => (
                    <th key={h} scope="col" className="py-1.5 pr-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i} className="border-t border-ink-100">
                    {r.map((c, j) => (
                      <td key={j} className="py-1.5 pr-3 tabular">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ height }} aria-hidden>
            {children}
          </div>
        )}
        <figcaption className="px-2 pt-2 text-xs text-ink-500">{summary}</figcaption>
      </figure>
    </Card>
  );
}

const axis = { fontSize: 11, fill: "#6f6875" };
const tooltipStyle = { borderRadius: 12, border: "1px solid #e4e0e7", boxShadow: "0 10px 30px rgb(43 23 54 / .12)", fontSize: 12 };

export function TrendChart({ data, x, series, format }: { data: object[]; x: string; series: { key: string; label: string; color?: string }[]; format?: (v: number) => string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color ?? chartColors[i]} stopOpacity={0.22} />
              <stop offset="100%" stopColor={s.color ?? chartColors[i]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} stroke="#efecf1" />
        <XAxis dataKey={x} tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis tick={axis} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => (format ? format(v) : String(v))} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => (format ? format(Number(v)) : String(v))} />
        {series.map((s, i) => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color ?? chartColors[i]} strokeWidth={2} fill={`url(#g-${s.key})`} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BarsChart({ data, x, series, format, layout = "horizontal", stacked }: { data: object[]; x: string; series: { key: string; label: string; color?: string }[]; format?: (v: number) => string; layout?: "horizontal" | "vertical"; stacked?: boolean }) {
  const vertical = layout === "vertical";
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout={vertical ? "vertical" : "horizontal"} margin={{ top: 8, right: 12, bottom: 0, left: vertical ? 8 : 0 }}>
        <CartesianGrid vertical={vertical} horizontal={!vertical} stroke="#efecf1" />
        {vertical ? (
          <>
            <XAxis type="number" tick={axis} tickLine={false} axisLine={false} tickFormatter={(v) => (format ? format(v) : String(v))} />
            <YAxis type="category" dataKey={x} tick={axis} tickLine={false} axisLine={false} width={120} />
          </>
        ) : (
          <>
            <XAxis dataKey={x} tick={axis} tickLine={false} axisLine={false} minTickGap={12} />
            <YAxis tick={axis} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => (format ? format(v) : String(v))} />
          </>
        )}
        <Tooltip cursor={{ fill: "#f6f1f9" }} contentStyle={tooltipStyle} formatter={(v) => (format ? format(Number(v)) : String(v))} />
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color ?? chartColors[i]} radius={stacked ? 0 : vertical ? [0, 6, 6, 0] : [6, 6, 0, 0]} stackId={stacked ? "a" : undefined} maxBarSize={28} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data, center }: { data: { name: string; value: number; color?: string }[]; center?: ReactNode }) {
  return (
    <div className="relative h-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={2} stroke="none">
            {data.map((d, i) => (
              <Cell key={d.name} fill={d.color ?? chartColors[i % chartColors.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      {center && <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">{center}</div>}
    </div>
  );
}

export function Legend({ items, className }: { items: { label: string; value?: ReactNode; color: string }[]; className?: string }) {
  return (
    <ul className={cx("space-y-1.5", className)}>
      {items.map((it) => (
        <li key={it.label} className="flex items-center justify-between gap-3 text-[13px]">
          <span className="flex min-w-0 items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: it.color }} aria-hidden />
            <span className="truncate text-ink-700">{it.label}</span>
          </span>
          {it.value !== undefined && <span className="font-semibold text-ink-900 tabular">{it.value}</span>}
        </li>
      ))}
    </ul>
  );
}
