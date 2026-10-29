"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter, PackageSearch, X } from "lucide-react";
import { useApi } from "@/shared/lib/api";
import { useSession } from "@/shared/lib/session";
import { dateTime } from "@/shared/lib/format";
import { ORDER_STATUSES, statusMeta } from "@/shared/lib/status";
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, SearchInput, Select, Spinner, StatusBadge } from "@/shared/ui/primitives";
import { DataTable, Pagination, type Column } from "@/shared/ui/data";

type People = { senderName: string; senderEmail: string; recipientName: string; deliveryCity: string; masked: boolean };
type Row = {
  id: string; reference: string; createdAt: string; people: People; vendor: { id: string; name: string };
  product: { productName: string; emoji: string; quantity: number }; total: number; status: string; paymentStatus: string;
  fulfilmentStatus: string; deliveryStatus: string; refundStatus: string; fraudHold: boolean; viaWishlist: boolean;
};
type Page = { items: Row[]; total: number; page: number; pageSize: number };

function OrdersInner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { fmt } = useSession();
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [debounced, setDebounced] = useState(search);
  const status = params.get("status") ?? "";
  const vendorId = params.get("vendorId") ?? "";
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "date", dir: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);
  const urlSearch = params.get("search") ?? "";
  useEffect(() => setSearch(urlSearch), [urlSearch]);
  useEffect(() => setPage(1), [debounced, status, vendorId, pageSize]);

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params.toString());
    if (v) p.set(k, v);
    else p.delete(k);
    router.replace(`${pathname}?${p.toString()}`);
  };

  const qs = new URLSearchParams({ search: debounced, status, sort: sort.key, dir: sort.dir, page: String(page), pageSize: String(pageSize), ...(vendorId ? { vendorId } : {}) });
  const { data, error, loading, refreshing, reload } = useApi<Page>(`/admin/orders?${qs}`);

  const columns: Column<Row>[] = [
    {
      key: "ref",
      header: "Order",
      sortKey: "reference",
      render: (r) => (
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-lavender-tint text-lg" aria-hidden>
            {r.product?.emoji}
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-ink-900">
              {r.reference} {r.fraudHold && <Badge tone="danger">Hold</Badge>}
            </p>
            <p className="max-w-[220px] truncate text-xs text-ink-500">
              {r.product?.productName}
              {r.product?.quantity > 1 && ` ×${r.product.quantity}`}
            </p>
          </div>
        </div>
      ),
    },
    { key: "date", header: "Date", sortKey: "date", render: (r) => <span className="text-xs whitespace-nowrap text-ink-700">{dateTime(r.createdAt)}</span> },
    {
      key: "sender",
      header: "Sender",
      hideOnMobile: true,
      render: (r) => (
        <div className="text-xs">
          <p className="font-medium text-ink-900">{r.people.senderName}</p>
          <p className="text-ink-500">{r.people.senderEmail}</p>
        </div>
      ),
    },
    {
      key: "recipient",
      header: "Recipient",
      render: (r) => (
        <div className="text-xs">
          <p className="font-medium text-ink-900">{r.people.recipientName}</p>
          <p className="text-ink-500">
            {r.people.deliveryCity}
            {r.viaWishlist && " · wishlist"}
          </p>
        </div>
      ),
    },
    { key: "vendor", header: "Vendor", sortKey: "vendor", render: (r) => <span className="text-xs font-medium">{r.vendor.name}</span> },
    { key: "total", header: "Value", sortKey: "total", align: "right", render: (r) => <span className="font-semibold">{fmt(r.total)}</span> },
    { key: "status", header: "Order status", sortKey: "status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "payment", header: "Payment", hideOnMobile: true, render: (r) => <StatusBadge status={r.paymentStatus} /> },
    { key: "fulfil", header: "Fulfilment", hideOnMobile: true, render: (r) => <StatusBadge status={r.fulfilmentStatus} /> },
    { key: "delivery", header: "Delivery", hideOnMobile: true, render: (r) => <StatusBadge status={r.deliveryStatus} /> },
    { key: "refund", header: "Refund", hideOnMobile: true, render: (r) => (r.refundStatus === "None" ? <span className="text-ink-300">—</span> : <StatusBadge status={r.refundStatus} />) },
  ];

  const filtersActive = !!(status || debounced || vendorId);

  return (
    <>
      <PageHeader title="Orders & Fulfilment" description="Search, filter and act on every order. Personal details are shown according to your role." />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Reference, product, vendor or name" label="Search orders" className="min-w-[220px] flex-1" />
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-ink-400" aria-hidden />
            <label htmlFor="status" className="sr-only">
              Status
            </label>
            <Select id="status" value={status} onChange={(e) => setParam("status", e.target.value)} className="w-52">
              <option value="">All statuses</option>
              <option value="attention">⚠ Needs attention</option>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusMeta(s).label}
                </option>
              ))}
            </Select>
            <label htmlFor="ps" className="sr-only">
              Rows per page
            </label>
            <Select id="ps" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="w-24">
              {[10, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </Select>
          </div>
          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              icon={X}
              onClick={() => {
                setSearch("");
                router.replace(pathname);
              }}
            >
              Clear
            </Button>
          )}
          {refreshing && !loading && <span className="text-xs text-ink-400">Updating…</span>}
        </div>
        {loading && <Spinner label="Loading orders" />}
        {error && (
          <div className="p-4">
            <ErrorState error={error} onRetry={reload} />
          </div>
        )}
        {data && (
          <>
            <DataTable
              caption="Orders"
              columns={columns}
              rows={data.items}
              rowKey={(r) => r.id}
              onRowClick={(r) => router.push(`/orders/${r.id}`)}
              rowLabel={(r) => `Open order ${r.reference}`}
              sort={sort}
              onSort={(k) => setSort((s) => ({ key: k, dir: s.key === k && s.dir === "desc" ? "asc" : "desc" }))}
              empty={<EmptyState icon={PackageSearch} title="No orders match" description="Try a different search or clear the filters." />}
            />
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
          </>
        )}
      </Card>
    </>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <OrdersInner />
    </Suspense>
  );
}
