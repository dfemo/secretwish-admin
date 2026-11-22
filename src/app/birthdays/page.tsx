"use client";

import { useState } from "react";
import { Cake, MailX, RefreshCw, Send } from "lucide-react";
import { api, useMutation, usePagedApi } from "@/shared/lib/api";
import { dateTime } from "@/shared/lib/format";
import { useAccess } from "@/lib/access";
import { Badge, Button, Card, EmptyState, ErrorState, Field, Notice, PageHeader, SearchInput, Spinner, Tabs, Textarea } from "@/shared/ui/primitives";
import { DataTable, PagedFooter, type Column } from "@/shared/ui/data";
import { Modal, useToast } from "@/shared/ui/overlay";

type Person = {
  id: string; name: string; email: string | null; city: string; birthday: string; isToday: boolean; apps: string[]; emailOff: boolean;
  greeted: { sentAt: string; sentBy: string; emailed: boolean; message: string | null } | null;
  /** Why a greeting can't be sent now (null when it can). */
  cannotSend: string | null;
};
type SendResult = { greeted: number; emailed: number; skipped: { id: string; reason: string }[] };

const MAX = 500;
const dayMonth = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "long" });

/** Admin → Birthdays: who has a birthday today or this week, and sending them birthday wishes (in the app and by email). */
export default function BirthdaysPage() {
  const { can } = useAccess();
  const toast = useToast();
  const [when, setWhen] = useState<"today" | "week">("today");
  const { data, items, error, loading, refreshing, reload, setPage, search, setSearch } = usePagedApi<Person>("/admin/birthdays", { when }, 25);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [composing, setComposing] = useState<Person[] | null>(null);
  const [message, setMessage] = useState("");
  const send = useMutation((ids: string[], text: string) => api<SendResult>("/admin/birthdays/send", { method: "POST", body: { userIds: ids, message: text.trim() || null } }));
  const sendable = items?.filter((p) => !p.cannotSend) ?? [];
  const chosen = sendable.filter((p) => picked.has(p.id));
  const counts = data?.counts ?? {};
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const cols: Column<Person>[] = [
    {
      key: "pick",
      header: <input type="checkbox" aria-label="Choose everyone who can be sent wishes on this page" className="size-4 accent-plum-700" disabled={sendable.length === 0}
        checked={sendable.length > 0 && sendable.every((p) => picked.has(p.id))}
        onChange={(e) => setPicked(e.target.checked ? new Set(sendable.map((p) => p.id)) : new Set())} />,
      hideOnMobile: true,
      render: (p) => <input type="checkbox" aria-label={`Choose ${p.name}`} className="size-4 accent-plum-700" disabled={!!p.cannotSend} checked={picked.has(p.id)} onChange={() => toggle(p.id)} />,
    },
    {
      key: "who",
      header: "Person",
      render: (p) => (
        <div>
          <p className="font-semibold text-ink-900">{p.name}</p>
          <p className="text-xs text-ink-500">{[p.email, p.city].filter(Boolean).join(" · ")}</p>
        </div>
      ),
    },
    { key: "day", header: "Birthday", render: (p) => (p.isToday ? <Badge tone="gold" icon={Cake}>Today</Badge> : <span className="whitespace-nowrap">{dayMonth(p.birthday)}</span>) },
    { key: "apps", header: "Uses", hideOnMobile: true, render: (p) => <span className="text-xs text-ink-700">{p.apps.join(", ") || "—"}</span> },
    {
      key: "status",
      header: "Wishes",
      render: (p) =>
        p.greeted ? (
          <div className="space-y-0.5">
            <Badge tone="success">Sent</Badge>
            <p className="text-[11px] text-ink-500">{p.greeted.sentBy} · {dateTime(p.greeted.sentAt)}{p.greeted.emailed ? " · emailed" : " · in the app only"}</p>
          </div>
        ) : p.emailOff ? (
          <span className="inline-flex items-center gap-1 text-xs text-ink-500"><MailX className="size-3.5" aria-hidden /> In the app only (email off)</span>
        ) : (
          <span className="text-xs text-ink-500">{p.isToday ? "Not sent yet" : "—"}</span>
        ),
    },
    {
      key: "act",
      header: "",
      render: (p) => (
        <Button size="sm" variant="secondary" icon={Send} disabled={!!p.cannotSend} title={p.cannotSend ?? "Send birthday wishes"} onClick={() => setComposing([p])}>
          Send wishes
        </Button>
      ),
    },
  ];

  const close = () => { setComposing(null); setMessage(""); send.setError(null); };

  return (
    <>
      <PageHeader
        title="Birthdays"
        description="People celebrating today (Nigerian time) and over the next week. Send them birthday wishes in the app and by email; each person gets them once a year, on the day."
        actions={<Button variant="secondary" icon={RefreshCw} loading={refreshing} onClick={reload}>Refresh</Button>}
      />
      <Card>
        <div className="space-y-3 border-b border-ink-100 p-4">
          <Tabs value={when} onChange={(v) => { setWhen(v); setPicked(new Set()); }}
            tabs={[{ value: "today", label: "Today", count: counts.today ?? 0 }, { value: "week", label: "Next 7 days", count: counts.week ?? 0 }]} />
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput value={search} onChange={setSearch} label="Search birthdays" placeholder="Name or email" className="min-w-[220px] flex-1" />
            {!!counts.today && <span className="text-sm text-ink-500">{counts.greetedToday ?? 0} of {counts.today} greeted today</span>}
            {can("customers.manage") && (
              <Button icon={Cake} disabled={chosen.length === 0} onClick={() => setComposing(chosen)}>
                Send wishes{chosen.length ? ` to ${chosen.length}` : ""}
              </Button>
            )}
          </div>
        </div>
        {loading && !items && <Spinner />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {items && (
          <DataTable caption="Birthdays" columns={cols} rows={items} rowKey={(p) => p.id}
            empty={<EmptyState icon={Cake} title={when === "today" ? "No birthdays today" : "No birthdays this week"} description={search ? "Try another search." : "Only people who've added their date of birth show here."} />} />
        )}
        <PagedFooter data={data} onPage={setPage} />
      </Card>

      <Modal open={!!composing} onClose={close} size="lg"
        title={composing?.length === 1 ? `Birthday wishes for ${composing[0].name}` : `Birthday wishes for ${composing?.length ?? 0} people`}
        description="They'll get it in the app, and by email unless they've turned email off. The email greets them by first name."
        footer={
          <>
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button icon={Send} loading={send.pending} disabled={message.length > MAX} onClick={async () => {
              if (!composing) return;
              const r = await send.run(composing.map((p) => p.id), message);
              if (!r) return;
              toast(r.greeted
                ? { tone: "success", title: `Birthday wishes sent to ${r.greeted} ${r.greeted === 1 ? "person" : "people"}`, body: `${r.emailed} by email.${r.skipped.length ? ` ${r.skipped.length} skipped: ${r.skipped[0].reason}` : ""}` }
                : { tone: "info", title: "No wishes sent", body: r.skipped[0]?.reason ?? "Nobody could be greeted." });
              setPicked(new Set());
              close();
              reload();
            }}>Send wishes</Button>
          </>
        }>
        <div className="space-y-4">
          <Field label="Your message (optional)" hint={`Write {name} where their first name should go. Leave it blank for the standard greeting: "Happy birthday, Ada! Everyone at VeilWish (SecretWish) hopes your day is full of lovely surprises." Up to ${MAX} characters.`}
            error={send.error?.errors?.message?.[0]}>
            {(id, d) => <Textarea id={id} aria-describedby={d} rows={4} maxLength={MAX} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Happy birthday, {name}! We hope your day is full of lovely surprises." />}
          </Field>
          <p className="text-right text-xs text-ink-500">{message.length}/{MAX}</p>
          {send.error && !send.error.errors?.message && <Notice tone="danger">{send.error.message}</Notice>}
        </div>
      </Modal>
    </>
  );
}
