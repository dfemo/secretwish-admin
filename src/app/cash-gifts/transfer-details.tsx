"use client";

import { AlertTriangle, ArrowRightLeft, BadgeCheck, CheckCircle2, CircleDollarSign, Gift, Radio, RefreshCw, Search, Send, XCircle, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { api, useApi, useMutation } from "@/shared/lib/api";
import { useSession } from "@/shared/lib/session";
import { dateTime, timeAgo } from "@/shared/lib/format";
import { Badge, Button, cx, ErrorState, Field, Notice, Spinner, Textarea } from "@/shared/ui/primitives";
import { Modal, useToast } from "@/shared/ui/overlay";

type Step = { at: string; kind: string; source: string; status: string | null; detail: string | null; gateway: string | null };
type Transfer = {
  id: string; reference: string; amountUsd: number; feeUsd: number; totalUsd: number; status: string; paymentReference: string | null;
  gateway: string | null; transferId: string | null; ourReference: string | null; pending: boolean; transferSubmittedAt: string | null;
  paidOutAt: string | null; receivedAt: string | null; failureReason: string | null; processedBy: string | null; sender: string; recipient: string;
  bank: { bankName: string; accountNumberLast4: string; accountName: string; verified: boolean } | null;
  canCheck: boolean; steps: Step[];
};

/** How each step looks on the timeline. */
const look: Record<string, { label: string; icon: LucideIcon; tone: string }> = {
  Created: { label: "Cash gift created", icon: Gift, tone: "bg-ink-100 text-ink-700" },
  SenderPaid: { label: "Sender paid", icon: CircleDollarSign, tone: "bg-plum-100 text-plum-800" },
  Sent: { label: "Transfer sent to the engine", icon: Send, tone: "bg-plum-100 text-plum-800" },
  Refused: { label: "Engine refused the transfer", icon: XCircle, tone: "bg-danger-50 text-danger-700" },
  Webhook: { label: "Engine webhook received", icon: Radio, tone: "bg-sky-100 text-sky-800" },
  StatusCheck: { label: "Status checked with the engine", icon: Search, tone: "bg-sky-100 text-sky-800" },
  Succeeded: { label: "Money reached the bank", icon: CheckCircle2, tone: "bg-success-50 text-success-700" },
  Failed: { label: "Transfer failed", icon: AlertTriangle, tone: "bg-danger-50 text-danger-700" },
  Received: { label: "Recipient confirmed it arrived", icon: BadgeCheck, tone: "bg-success-50 text-success-700" },
  Confirmed: { label: "Marked transferred by staff", icon: BadgeCheck, tone: "bg-success-50 text-success-700" },
};

/** A cash gift's transfer, step by step: amounts, where it went, the engine's ids, and every event up to the bank's confirmation. */
export function TransferDetails({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const { fmt } = useSession();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<Transfer>(id ? `/admin/cash-gifts/${id}/transfer` : null);
  const check = useMutation((gid: string) => api<{ status: string; succeeded: boolean | null; message: string | null }>(`/admin/cash-gifts/${gid}/check-transfer`, { method: "POST" }));
  const t = data && data.id === id ? data : undefined;
  const [marking, setMarking] = useState(false);
  const [note, setNote] = useState("");
  const mark = useMutation((gid: string, text: string) => api(`/admin/cash-gifts/${gid}/mark-transferred`, { method: "POST", body: { note: text } }));
  const [answer, setAnswer] = useState<{ id: string; status: string; succeeded: boolean | null; message: string | null } | null>(null);

  return (
    <Modal open={!!id} onClose={onClose} size="xl" title={t ? `Transfer for ${t.reference}` : "Transfer"} description={t ? `${t.sender} → ${t.recipient}` : undefined}
      footer={t?.canCheck ? (
        <Button icon={RefreshCw} loading={check.pending} onClick={async () => {
          const r = await check.run(t.id);
          if (r) {
            setAnswer({ id: t.id, ...r });
            toast(r.succeeded === true ? { tone: "success", title: `${t.gateway} says it's paid`, body: "Marked transferred; the recipient was asked to confirm." }
              : r.succeeded === false ? { tone: "error", title: `${t.gateway} says it failed`, body: r.message ?? r.status }
              : { tone: "info", title: `Still on its way (${r.status})`, body: "VeilWish (SecretWish) checks again every few minutes." });
            reload();
            onChanged();
          }
        }}>Check status with {t.gateway}</Button>
      ) : undefined}>
      {t?.canCheck && (
        <div className="mb-4 rounded-2xl border border-ink-100 p-4">
          {!marking ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-ink-700">
              <span>{t.gateway}&apos;s dashboard shows it paid, but it&apos;s still sending here?</span>
              <Button size="sm" variant="secondary" icon={BadgeCheck} onClick={() => setMarking(true)}>Mark as transferred</Button>
            </div>
          ) : (
            <form className="grid gap-3" onSubmit={async (e) => {
              e.preventDefault();
              if ((await mark.run(t.id, note)) !== undefined) {
                toast({ tone: "success", title: `${t.reference} marked transferred`, body: "The recipient was asked to confirm it arrived." });
                setMarking(false); setNote(""); reload(); onChanged();
              }
            }}>
              <Field label="How do you know it arrived?" hint={`E.g. "${t.gateway} dashboard shows transfer ${t.transferId ?? "…"} successful". Kept on the timeline and in the audit log.`}
                error={mark.error?.errors?.note?.[0]}>
                {(fid, d) => <Textarea id={fid} aria-describedby={d} required minLength={5} maxLength={300} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}
              </Field>
              {mark.error && !mark.error.errors && <Notice tone="danger">{mark.error.message}</Notice>}
              <div className="flex gap-2">
                <Button type="submit" size="sm" icon={BadgeCheck} loading={mark.pending}>Mark as transferred</Button>
                <Button size="sm" variant="ghost" onClick={() => { setMarking(false); mark.setError(null); }}>Cancel</Button>
              </div>
            </form>
          )}
        </div>
      )}
      {loading && !t && <Spinner />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {check.error && <Notice tone="danger" title="Couldn't ask the engine">{check.error.message}</Notice>}
      {t && answer?.id === t.id && (
        <Notice tone={answer.succeeded === true ? "success" : answer.succeeded === false ? "danger" : "info"} title={`${t.gateway ?? "The engine"} says: ${answer.status}`}>
          {answer.succeeded === null
            ? `${answer.message ? `${answer.message}. ` : ""}It isn't finished at ${t.gateway} yet, so it stays as sending. If ${t.gateway}'s dashboard shows it as successful, compare the transfer id below with the one there.`
            : answer.message ?? (answer.succeeded ? "Marked transferred." : "Marked failed.")}
        </Notice>
      )}
      {t && (
        <div className="space-y-5">
          <dl className="grid gap-3 rounded-2xl bg-ink-50 p-4 text-sm sm:grid-cols-2">
            <Row label="To recipient" value={fmt(t.amountUsd)} />
            <Row label="Fee · total paid" value={`${fmt(t.feeUsd)} · ${fmt(t.totalUsd)}`} />
            <Row label="Bank" value={t.bank ? `${t.bank.bankName} ••••${t.bank.accountNumberLast4}` : "No bank details"} />
            <Row label="Account name" value={t.bank ? <>{t.bank.accountName} {t.bank.verified ? <Badge tone="success">Checked with bank</Badge> : <Badge tone="warning">Not checked</Badge>}</> : "—"} />
            <Row label="Engine" value={t.gateway ?? "Not sent yet"} />
            <Row label="Engine's transfer id" value={<code className="break-all">{t.transferId ?? "—"}</code>} />
            <Row label="VeilWish (SecretWish) reference" value={<code className="break-all">{t.ourReference ?? "—"}</code>} />
            <Row label="Sender's payment" value={<code className="break-all">{t.paymentReference ?? "—"}</code>} />
          </dl>

          {t.pending && (
            <Notice tone="info" icon={ArrowRightLeft} title="Waiting for the bank">
              Sent {t.transferSubmittedAt ? timeAgo(t.transferSubmittedAt) : ""} with {t.gateway}. It&apos;s marked transferred when {t.gateway}&apos;s webhook arrives, or when
              VeilWish (SecretWish) checks with {t.gateway} (every few minutes, or now with the button below).
            </Notice>
          )}
          {t.failureReason && t.status === "PayoutPending" && !t.pending && <Notice tone="danger">{t.failureReason}. It can be sent again from the list.</Notice>}

          <ol className="relative space-y-4 border-l border-ink-100 pl-6">
            {t.steps.map((s, i) => {
              const l = look[s.kind] ?? { label: s.kind, icon: Radio, tone: "bg-ink-100 text-ink-700" };
              return (
                <li key={i} className="relative">
                  <span className={cx("absolute -left-[37px] grid size-7 place-items-center rounded-full ring-4 ring-white", l.tone)}><l.icon className="size-3.5" aria-hidden /></span>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <p className="font-semibold text-ink-900">{l.label}</p>
                    {s.status && <Badge tone="neutral">{s.status}</Badge>}
                  </div>
                  <p className="text-xs text-ink-500">{dateTime(s.at)} · {s.source}</p>
                  {s.detail && <p className="mt-1 text-sm text-ink-700 break-words">{s.detail}</p>}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="mt-0.5 flex flex-wrap items-center gap-1.5 font-medium text-ink-900">{value}</dd>
    </div>
  );
}
