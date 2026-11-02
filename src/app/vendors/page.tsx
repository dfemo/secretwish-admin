"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BadgeCheck, Store } from "lucide-react";
import { useApi, usePagedApi } from "@/shared/lib/api";
import { useSession } from "@/shared/lib/session";
import { date, pct } from "@/shared/lib/format";
import { Avatar, Card, EmptyState, ErrorState, PageHeader, SearchInput, Spinner, StatusBadge, Tabs } from "@/shared/ui/primitives";
import { DataTable, type Column, PagedFooter } from "@/shared/ui/data";

type Vendor = { id: string; name: string; contactName: string; city: string; primaryCategory: string; status: string; businessVerified: boolean; bankVerified: boolean; idVerified: boolean; rating: number; acceptanceRate: number; onTimeRate: number; appliedAt: string };
type Row = { vendor: Vendor; kyc: { verified: number; submitted: number; rejected: number; readyForReview: boolean }; orders: number; gmv: number; products: number; counts: Record<string, number> };

function VendorsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState(params.get("status") ?? "");
  const { data: paged, items: data, error, loading, reload, setPage, search, setSearch } = usePagedApi<Row>("/admin/vendors", { status }, 25);
  const { fmt } = useSession();
  const counts = paged?.counts ?? {};

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
        const k = r.kyc;
        return (
          <span className="inline-flex flex-col text-xs">
            <span className="inline-flex items-center gap-1">
              <BadgeCheck className={k.verified === 3 ? "size-4 text-success-600" : "size-4 text-ink-300"} aria-hidden /> {k.verified}/3 verified
            </span>
            {k.verified < 3 && (
              <span className={k.rejected ? "text-danger-700" : k.readyForReview ? "font-semibold text-warning-700" : "text-ink-500"}>
                {k.rejected ? `${k.rejected} sent back` : k.readyForReview ? "Ready to review" : `${k.submitted + k.verified}/3 submitted`}
              </span>
            )}
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
          <>
          <DataTable
            caption="Vendors"
            columns={columns}
            rows={data}
            rowKey={(r) => r.vendor.id}
            onRowClick={(r) => router.push(`/vendors/${r.vendor.id}`)}
            rowLabel={(r) => `Open ${r.vendor.name}`}
            empty={<EmptyState icon={Store} title="No vendors here" />}
          />
          <PagedFooter data={paged} onPage={setPage} />
          </>
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
