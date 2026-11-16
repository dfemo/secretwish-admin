"use client";

import { useState } from "react";
import { CheckCircle2, Globe, Mail, MailOpen } from "lucide-react";
import { api, useMutation, usePagedApi } from "@/shared/lib/api";
import { useAccess } from "@/lib/access";
import { PagedFooter } from "@/shared/ui/data";
import { dateTime, timeAgo } from "@/shared/lib/format";
import { Badge, Button, ButtonLink, Card, CardHeader, EmptyState, ErrorState, Notice, SearchInput, Spinner } from "@/shared/ui/primitives";
import { Modal } from "@/shared/ui/overlay";

type Enquiry = { id: string; reference: string; topic: string; message: string; handled: boolean; createdAt: string; name: string; email: string };

/** Messages sent through the public website's contact form. Support staff open one to see who sent it and reply by email. */
export function WebsiteEnquiries() {
  const { data: paged, items: data, error, loading, reload, setPage, search, setSearch } = usePagedApi<Enquiry>("/admin/enquiries", {}, 10);
  const done = useMutation((id: string) => api(`/admin/enquiries/${id}/handled`, { method: "POST" }));
  const openOne = useMutation((id: string) => api<Enquiry>(`/admin/enquiries/${id}/open`, { method: "POST" }));
  const [opened, setOpened] = useState<Enquiry | null>(null);
  const open = paged?.counts?.open ?? 0;
  const canManage = useAccess().can("support.manage");
  return (
    <Card className="mt-6">
      <CardHeader title="Website enquiries" description="From the public contact form. Open one to see the sender's details and reply." action={<Badge tone={open ? "warning" : "success"}>{open} open</Badge>} />
      <div className="border-b border-ink-100 px-5 pb-3"><SearchInput value={search} onChange={setSearch} label="Search enquiries" placeholder="Reference, topic or message" className="sm:w-80" /></div>
      {loading && <Spinner />}
      {error && <div className="p-4"><ErrorState error={error} onRetry={reload} /></div>}
      {openOne.error && <Notice tone="danger" className="m-4">{openOne.error.message}</Notice>}
      {data?.length === 0 && <EmptyState icon={Globe} title={search ? "No enquiries match" : "No enquiries yet"} />}
      <ul className="divide-y divide-ink-100">
        {data?.map((e) => (
          <li key={e.id} className="flex flex-wrap items-start gap-3 px-5 py-3.5">
            <div className="min-w-[220px] flex-1">
              <p className="text-sm font-semibold">{e.topic} <span className="font-normal text-ink-500">· {e.reference} · {e.name} ({e.email}) · {timeAgo(e.createdAt)}</span></p>
              <p className="mt-0.5 line-clamp-2 text-[13px] whitespace-pre-line text-ink-700">{e.message}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" icon={MailOpen} loading={openOne.pending} onClick={async () => { const r = await openOne.run(e.id); if (r) setOpened(r); }}>Open</Button>
              {e.handled ? (
                <Badge tone="success" icon={CheckCircle2}>Handled</Badge>
              ) : (
                canManage && <Button size="sm" variant="subtle" loading={done.pending} onClick={() => done.run(e.id)}>Mark handled</Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <PagedFooter data={paged} onPage={setPage} />
      <Modal
        open={!!opened}
        onClose={() => setOpened(null)}
        size="lg"
        title={opened ? `${opened.topic} · ${opened.reference}` : ""}
        description={opened ? `Sent ${dateTime(opened.createdAt)}. Opening it is recorded in the audit log.` : undefined}
        footer={opened && (
          <>
            <Button variant="ghost" onClick={() => setOpened(null)}>Close</Button>
            {!opened.handled && canManage && (
              <Button variant="secondary" icon={CheckCircle2} loading={done.pending}
                onClick={async () => { if ((await done.run(opened.id)) !== undefined) setOpened({ ...opened, handled: true }); }}>
                Mark handled
              </Button>
            )}
            <ButtonLink href={`mailto:${opened.email}?subject=${encodeURIComponent(`Re: ${opened.topic} (${opened.reference})`)}`} icon={Mail}>Reply by email</ButtonLink>
          </>
        )}
      >
        {opened && (
          <>
            <dl className="grid gap-3 rounded-2xl bg-ink-50 p-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-ink-500">From</dt><dd className="font-semibold text-ink-900">{opened.name}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-ink-500">Email</dt><dd className="font-semibold break-all text-ink-900">{opened.email}</dd></div>
            </dl>
            <p className="mt-4 text-sm whitespace-pre-line text-ink-900">{opened.message}</p>
            {opened.handled && <Badge tone="success" icon={CheckCircle2} className="mt-4">Handled</Badge>}
          </>
        )}
      </Modal>
    </Card>
  );
}
