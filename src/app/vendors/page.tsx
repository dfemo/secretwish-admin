"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BadgeCheck, Store } from "lucide-react";
import { useApi } from "@/shared/lib/api";
import { useSession } from "@/shared/lib/session";
import { date, pct } from "@/shared/lib/format";
import { Avatar, Card, EmptyState, ErrorState, PageHeader, SearchInput, Spinner, StatusBadge, Tabs } from "@/shared/ui/primitives";
import { DataTable, type Column } from "@/shared/ui/data";

type Vendor = { id: string; name: string; contactName: string; city: string; primaryCategory: string; status: string; businessVerified: boolean; bankVerified: boolean; idVerified: boolean; rating: number; acceptanceRate: number; onTimeRate: number; appliedAt: string };
type Row = { vendor: Vendor; orders: number; gmv: number; products: number; counts: Record<string, number> };

function VendorsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [search, setSearch] = useState("");
  const { data, error, loading, reload } = useApi<Row[]>(`/admin/vendors?status=${status}&search=${encodeURIComponent(search)}`);
  const { data: all } = useApi<Row[]>(`/admin/vendors`);
  const { fmt } = useSession();
  const counts = all?.[0]?.counts ?? {};

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Vendor",
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.vendor.name} size={34} />
          <div>
            <p className="font-semibold">{r.vendor.name}</p>
            <p className="text-xs text-ink-500">
              {r.vendor.primaryCategory} · {r.vendor.city}
            </p>
          </div>
        </div>
      ),
    },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.vendor.status} /> },
    {
      key: "verify",
      header: "Verification",
      render: (r) => {
        const n = [r.vendor.businessVerified, r.vendor.bankVerified, r.vendor.idVerified].filter(Boolean).length;
        return (
          <span className="inline-flex items-center gap-1 text-xs">
            <BadgeCheck className={n === 3 ? "size-4 text-success-600" : "size-4 text-ink-300"} aria-hidden /> {n}/3 checks
          </span>
        );
      },
    },
    { key: "products", header: "Products", align: "right", render: (r) => r.products },
    { key: "orders", header: "Orders", align: "right", render: (r) => r.orders },
    { key: "gmv", header: "GMV", align: "right", render: (r) => fmt(r.gmv) },
    { key: "acc", header: "Acceptance", align: "right", hideOnMobile: true, render: (r) => (r.vendor.status === "Pending" ? "—" : pct(r.vendor.acceptanceRate * 100, 0)) },
    { key: "ontime", header: "On-time", align: "right", hideOnMobile: true, render: (r) => (r.vendor.status === "Pending" ? "—" : pct(r.vendor.onTimeRate * 100, 0)) },
    { key: "applied", header: "Applied", hideOnMobile: true, render: (r) => <span className="text-xs">{date(r.vendor.appliedAt)}</span> },
  ];

  return (
    <>
      <PageHeader title="Vendors & Approvals" description="Review applications, monitor performance and record reasons for every decision." />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
          <Tabs
            value={status}
            onChange={setStatus}
            tabs={[
              { value: "", label: "All", count: Object.values(counts).reduce((a, b) => a + b, 0) },
              { value: "Pending", label: "Applications", count: counts.Pending ?? 0 },
              { value: "Approved", label: "Approved", count: counts.Approved ?? 0 },
              { value: "Suspended", label: "Suspended", count: counts.Suspended ?? 0 },
              { value: "Rejected", label: "Rejected", count: counts.Rejected ?? 0 },
            ]}
          />
          <SearchInput value={search} onChange={setSearch} placeholder="Vendor or city" label="Search vendors" className="min-w-[200px] flex-1" />
        </div>
        {loading && <Spinner />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {data && (
          <DataTable
            caption="Vendors"
            columns={columns}
            rows={data}
            rowKey={(r) => r.vendor.id}
            onRowClick={(r) => router.push(`/vendors/${r.vendor.id}`)}
            rowLabel={(r) => `Open ${r.vendor.name}`}
            empty={<EmptyState icon={Store} title="No vendors here" />}
          />
        )}
      </Card>
    </>
  );
}

export default function VendorsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <VendorsInner />
    </Suspense>
  );
}
