"use client";

import { type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cx } from "./primitives";

export type Column<T> = {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  sortKey?: string;
  className?: string;
  /** Hide this column in the mobile card layout. */
  hideOnMobile?: boolean;
  align?: "left" | "right";
};

/**
 * Accessible table that becomes a stacked card list on small screens.
 * Sorting is controlled by the caller so it can be server- or client-side.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  sort,
  onSort,
  caption,
  empty,
  rowLabel,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (r: T) => string;
  onRowClick?: (r: T) => void;
  sort?: { key: string; dir: "asc" | "desc" };
  onSort?: (key: string) => void;
  caption: string;
  empty?: ReactNode;
  rowLabel?: (r: T) => string;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-ink-100 text-xs text-ink-500">
              {columns.map((c) => {
                const active = sort?.key === c.sortKey;
                return (
                  <th key={c.key} scope="col" className={cx("px-4 py-3 font-semibold whitespace-nowrap first:pl-5 last:pr-5", c.align === "right" && "text-right", c.className)} aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}>
                    {c.sortKey && onSort ? (
                      <button type="button" onClick={() => onSort(c.sortKey!)} className="inline-flex items-center gap-1 hover:text-ink-900">
                        {c.header}
                        {active ? sort!.dir === "asc" ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden /> : <ArrowUpDown className="size-3 opacity-40" aria-hidden />}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={rowKey(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                onKeyDown={onRowClick ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onRowClick(r)) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                aria-label={onRowClick && rowLabel ? rowLabel(r) : undefined}
                className={cx("border-b border-ink-100/80 last:border-0", onRowClick && "cursor-pointer hover:bg-plum-50/50 focus-visible:bg-plum-50")}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cx("px-4 py-3 align-middle whitespace-nowrap first:pl-5 last:pr-5", c.align === "right" && "text-right tabular", c.className)}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-ink-100 md:hidden" aria-label={caption}>
        {rows.map((r) => {
          const [first, ...rest] = columns.filter((c) => !c.hideOnMobile);
          const content = (
            <>
              <div className="mb-2">{first?.render(r)}</div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                {rest.map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="text-[11px] text-ink-500">{c.header}</dt>
                    <dd className="truncate text-[13px]">{c.render(r)}</dd>
                  </div>
                ))}
              </dl>
            </>
          );
          return (
            <li key={rowKey(r)}>
              {onRowClick ? (
                <button type="button" onClick={() => onRowClick(r)} className="block w-full px-4 py-3.5 text-left hover:bg-plum-50/50">
                  {content}
                </button>
              ) : (
                <div className="px-4 py-3.5">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav className="flex items-center justify-between gap-3 border-t border-ink-100 px-5 py-3 text-xs text-ink-500" aria-label="Pagination">
      <span>
        Showing <b className="text-ink-900">{from}</b>–<b className="text-ink-900">{to}</b> of <b className="text-ink-900">{total}</b>
      </span>
      <div className="flex items-center gap-1">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-lg p-1.5 hover:bg-ink-100 disabled:opacity-40" aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </button>
        <span className="px-2 font-semibold text-ink-700">
          {page} / {pages}
        </span>
        <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className="rounded-lg p-1.5 hover:bg-ink-100 disabled:opacity-40" aria-label="Next page">
          <ChevronRight className="size-4" />
        </button>
      </div>
    </nav>
  );
}

export type TimelineItem = { id: string; at: string; title: string; detail?: string; actor?: string; internal?: boolean; done?: boolean };

/** Vertical order timeline (completed steps filled, upcoming steps hollow). */
export function Timeline({ items, formatTime }: { items: TimelineItem[]; formatTime: (iso: string) => string }) {
  return (
    <ol className="relative">
      {items.map((it, i) => {
        const done = it.done !== false;
        return (
          <li key={it.id} className="relative flex gap-4 pb-6 last:pb-0">
            {i < items.length - 1 && <span className={cx("absolute top-7 left-[13px] h-[calc(100%-1.25rem)] w-px", done ? "bg-plum-300" : "bg-ink-200")} aria-hidden />}
            <span className={cx("relative z-10 mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ring-4 ring-white", done ? (it.internal ? "bg-gold-500 text-plum-950" : "bg-plum-700 text-white") : "border-2 border-ink-200 bg-white")}>
              {done && (
                <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                  <path d="m5 12 5 5 9-10" />
                </svg>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className={cx("font-display text-[15px] font-semibold", done ? "text-plum-900" : "text-ink-400")}>
                  {it.title}
                  {it.internal && <span className="ml-2 rounded bg-gold-100 px-1.5 py-0.5 align-middle font-sans text-[10px] font-semibold text-gold-700 uppercase">Internal</span>}
                </p>
                {it.at && <time className="text-xs text-ink-400 tabular">{formatTime(it.at)}</time>}
              </div>
              {it.detail && <p className={cx("mt-0.5 text-[13px]", done ? "text-ink-700" : "text-ink-400")}>{it.detail}</p>}
              {it.actor && <p className="mt-0.5 text-[11px] text-ink-400">by {it.actor}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
