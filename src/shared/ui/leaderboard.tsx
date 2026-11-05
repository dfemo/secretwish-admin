"use client";

import { useState } from "react";
import { Crown, Medal, Trophy } from "lucide-react";
import { useApi } from "../lib/api";
import { Card, CardHeader, cx, EmptyState, ErrorState, PageHeader, Skeleton, Tabs } from "./primitives";

/** Everyone but you is shown by masked name and email ("Ada O.", "a***@gmail.com"). */
type Row = { rank: number; score: number; secondary: number; you: boolean; name: string; email?: string | null };
export type MyBoard = { rank: number | null; total: number; score: number; secondary: number; toNext: number | null; topPercent: number | null; top: Row[]; you: Row | null };

/** "1st", "2nd", "23rd". */
export function ordinal(n: number) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${s}`;
}

/**
 * Where you stand, with nobody else fully identified: your place, how far to the next one, and the top ten by masked name and email.
 * `score` describes the main figure ("12 gifts sent"); `secondary` an optional second one shown beside it.
 */
export function MyLeaderboard({
  path, title, description, score, secondary, next, empty,
}: {
  path: string; title: string; description: string;
  score: (n: number) => string; secondary?: (n: number) => string;
  /** e.g. n => `Send ${n} more gifts to move up a place.` */
  next: (n: number) => string;
  empty: string;
}) {
  const [period, setPeriod] = useState<"all" | "30d">("all");
  const { data, error, loading, reload } = useApi<MyBoard>(`${path}?period=${period}`);
  const RankIcon = data?.rank === 1 ? Crown : data?.rank && data.rank <= 3 ? Medal : Trophy;

  return (
    <>
      <PageHeader title={title} description={description} />
      <Tabs className="mb-6 w-fit" value={period} onChange={setPeriod} tabs={[{ value: "all", label: "All time" }, { value: "30d", label: "Last 30 days" }]} />
      {loading && !data ? (
        <Skeleton className="h-64 rounded-3xl" />
      ) : error || !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-plum-800 to-plum-950 p-6 text-ivory-50">
              <p className="flex items-center gap-2 text-sm font-semibold text-gold-300"><RankIcon className="size-4" aria-hidden /> Your position</p>
              {data.rank ? (
                <>
                  <p className="mt-2 font-display text-6xl font-semibold tabular">{ordinal(data.rank)}</p>
                  <p className="mt-1 text-sm text-plum-200">of {data.total.toLocaleString()} · top {data.topPercent}%</p>
                </>
              ) : (
                <>
                  <p className="mt-2 font-display text-3xl font-semibold">Not ranked yet</p>
                  <p className="mt-1 text-sm text-plum-200">{empty}</p>
                </>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-4 p-5">
              <div>
                <dt className="text-xs text-ink-500">You</dt>
                <dd className="mt-0.5 text-lg font-semibold">{score(data.score)}</dd>
              </div>
              {secondary && (
                <div>
                  <dt className="text-xs text-ink-500">Also</dt>
                  <dd className="mt-0.5 text-lg font-semibold">{secondary(data.secondary)}</dd>
                </div>
              )}
              <div className="col-span-2 rounded-xl bg-ivory-100 px-4 py-3 text-sm text-ink-700">
                {data.rank === 1 ? "You're in first place. Keep it up!" : data.toNext ? next(data.toNext) : data.rank ? "You're level with the place above." : empty}
              </div>
            </dl>
          </Card>
          <Card>
            <CardHeader title="Top 10" description="Names and emails are partly hidden to keep everyone private." />
            {data.top.length === 0 ? (
              <EmptyState icon={Trophy} title="Nobody on the board yet" />
            ) : (
              <ol className="divide-y divide-ink-100 px-5 pb-3">
                {[...data.top, ...(data.you ? [data.you] : [])].map((r, i) => (
                  <li key={i} className={cx("flex items-center gap-3 py-2.5 text-sm", r.you && "-mx-5 bg-plum-50 px-5 font-semibold", data.you && i === data.top.length && "border-t-2 border-dashed")}>
                    <span className={cx("grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold tabular", r.rank === 1 ? "bg-gold-400 text-plum-950" : r.rank <= 3 ? "bg-plum-100 text-plum-800" : "bg-ink-50 text-ink-700")}>{r.rank}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{r.name}{r.you && <span className="ml-1.5 rounded-full bg-plum-700 px-1.5 py-0.5 text-[10px] font-bold uppercase text-ivory-50">You</span>}</span>
                      {r.email && <span className="block truncate text-xs font-normal text-ink-500">{r.email}</span>}
                    </span>
                    <span className="tabular">{score(r.score)}</span>
                    {secondary && <span className="hidden w-32 text-right text-xs text-ink-500 tabular sm:block">{secondary(r.secondary)}</span>}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
