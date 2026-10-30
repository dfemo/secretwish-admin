"use client";

import { CheckCircle2, Globe } from "lucide-react";
import { api, useMutation, usePagedApi } from "@/shared/lib/api";
import { PagedFooter } from "@/shared/ui/data";
import { timeAgo } from "@/shared/lib/format";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, SearchInput, Spinner } from "@/shared/ui/primitives";

type Enquiry = { id: string; reference: string; topic: string; message: string; handled: boolean; createdAt: string; name: string; email: string };

/** Messages sent through the public website's contact form. */
export function WebsiteEnquiries() {
  const { data: paged, items: data, error, loading, reload, setPage, search, setSearch } = usePagedApi<Enquiry>("/admin/enquiries", {}, 10);
  const done = useMutation((id: string) => api(`/admin/enquiries/${id}/handled`, { method: "POST" }));
  const open = paged?.counts?.open ?? 0;
  return (
    <Card className="mt-6">
      <CardHeader title="Website enquiries" description="From the public contact form" action={<Badge tone={open ? "warning" : "success"}>{open} open</Badge>} />
      <div className="border-b border-ink-100 px-5 pb-3"><SearchInput value={search} onChange={setSearch} label="Search enquiries" placeholder="Reference, topic or message" className="sm:w-80" /></div>
      {loading && <Spinner />}
      {error && <div className="p-4"><ErrorState error={error} onRetry={reload} /></div>}
      {data?.length === 0 && <EmptyState icon={Globe} title={search ? "No enquiries match" : "No enquiries yet"} />}
      <ul className="divide-y divide-ink-100">
        {data?.map((e) => (
          <li key={e.id} className="flex flex-wrap items-start gap-3 px-5 py-3.5">
            <div className="min-w-[220px] flex-1">
              <p className="text-sm font-semibold">{e.topic} <span className="font-normal text-ink-500">· {e.reference} · {e.name} ({e.email}) · {timeAgo(e.createdAt)}</span></p>
              <p className="mt-0.5 text-[13px] whitespace-pre-line text-ink-700">{e.message}</p>
            </div>
            {e.handled ? (
              <Badge tone="success" icon={CheckCircle2}>Handled</Badge>
            ) : (
              <Button size="sm" variant="subtle" loading={done.pending} onClick={() => done.run(e.id)}>Mark handled</Button>
            )}
          </li>
        ))}
      </ul>
      <PagedFooter data={paged} onPage={setPage} />
    </Card>
  );
}
