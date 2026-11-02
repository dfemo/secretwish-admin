"use client";

import { useState } from "react";
import { BadgeCheck, CircleX, Clock, FileSearch, FileUp } from "lucide-react";
import { api, useMutation } from "@/shared/lib/api";
import { dateTime } from "@/shared/lib/format";
import { Badge, Button, Card, CardHeader, Notice } from "@/shared/ui/primitives";
import { ConfirmDialog, useToast } from "@/shared/ui/overlay";

export type KycCheck = {
  kind: "Business" | "Bank" | "Identity"; label: string; asks: string; status: "NotSubmitted" | "Submitted" | "Verified" | "Rejected";
  reference: string | null; detail: string | null; hasDocument: boolean; documentName: string | null; reviewNote: string | null;
  submittedAt: string | null; reviewedAt: string | null; reviewedBy: string | null; onFile: boolean;
};
export type Kyc = { readyForReview: boolean; allVerified: boolean; checks: KycCheck[] };

const badge = {
  NotSubmitted: { label: "Not submitted", tone: "neutral", icon: FileUp },
  Submitted: { label: "Awaiting your review", tone: "warning", icon: Clock },
  Verified: { label: "Verified", tone: "success", icon: BadgeCheck },
  Rejected: { label: "Sent back", tone: "danger", icon: CircleX },
} as const;

/** Staff review of a vendor's verification checks: see what was sent, open documents, verify or send back with a reason. */
export function KycReview({ vendorId, kyc, canReview, onChanged }: { vendorId: string; kyc: Kyc; canReview: boolean; onChanged: () => void }) {
  const toast = useToast();
  const [rejecting, setRejecting] = useState<KycCheck | null>(null);
  const review = useMutation((kind: string, decision: string, reason?: string) => api(`/admin/vendors/${vendorId}/kyc/${kind}/review`, { method: "POST", body: { decision, reason } }));
  const open = useMutation(async (kind: string) => {
    const d = await api<{ fileName: string; contentType: string; dataBase64: string }>(`/admin/vendors/${vendorId}/kyc/${kind}/document`);
    const bytes = Uint8Array.from(atob(d.dataBase64), (c) => c.charCodeAt(0));
    window.open(URL.createObjectURL(new Blob([bytes], { type: d.contentType })), "_blank", "noopener");
    return d;
  });
  const submitted = kyc.checks.filter((c) => c.status !== "NotSubmitted").length;

  return (
    <Card>
      <CardHeader
        title="Verification (KYC)"
        description={
          kyc.allVerified ? "All checks verified." : kyc.readyForReview ? "Everything is in. Review each check before approving." : `Waiting for the vendor: ${submitted} of ${kyc.checks.length} submitted.`
        }
      />
      <ul className="space-y-3 px-5 pb-5">
        {kyc.checks.map((c) => {
          const b = badge[c.status];
          return (
            <li key={c.kind} className="rounded-xl bg-ink-50 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{c.label}</span>
                <Badge tone={b.tone} icon={b.icon}>{b.label}</Badge>
              </div>
              {c.status === "NotSubmitted" && <p className="mt-1 text-xs text-ink-500">The vendor hasn&apos;t sent this yet.</p>}
              {c.onFile && <p className="mt-1 text-xs text-ink-500">Verified before checks were recorded (demo store).</p>}
              {c.reference && (
                <dl className="mt-2 grid gap-x-3 gap-y-1 text-xs sm:grid-cols-[auto_1fr]">
                  <dt className="text-ink-500">Details</dt>
                  <dd className="font-medium">{c.detail} · {c.reference}</dd>
                  {c.submittedAt && (<><dt className="text-ink-500">Submitted</dt><dd>{dateTime(c.submittedAt)}</dd></>)}
                  {c.reviewedAt && (<><dt className="text-ink-500">Reviewed</dt><dd>{dateTime(c.reviewedAt)}{c.reviewedBy && ` by ${c.reviewedBy}`}</dd></>)}
                </dl>
              )}
              {c.status === "Rejected" && c.reviewNote && <p className="mt-2 text-xs text-danger-700">Sent back: {c.reviewNote}</p>}
              {(c.hasDocument || (canReview && c.status === "Submitted")) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {c.hasDocument && canReview && (
                    <Button size="sm" variant="secondary" icon={FileSearch} loading={open.pending} onClick={() => open.run(c.kind)}>
                      Open {c.documentName ?? "document"}
                    </Button>
                  )}
                  {canReview && c.status === "Submitted" && (
                    <>
                      <Button size="sm" icon={BadgeCheck} loading={review.pending} onClick={async () => { if (await review.run(c.kind, "verify")) { toast({ tone: "success", title: `${c.label} verified` }); onChanged(); } }}>
                        Verify
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRejecting(c)}>Send back</Button>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {(review.error || open.error) && <Notice tone="danger" className="mx-5 mb-5">{(review.error ?? open.error)!.message}</Notice>}
      <ConfirmDialog
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title={`Send back ${rejecting?.label.toLowerCase()}?`}
        description="The vendor is notified with your reason and can resubmit."
        reasonLabel="What needs fixing?"
        reasonPlaceholder="e.g. The certificate is blurry. Please upload a clear scan."
        confirmLabel="Send back"
        tone="danger"
        pending={review.pending}
        onConfirm={async (reason) => {
          if (rejecting && (await review.run(rejecting.kind, "reject", reason))) {
            toast({ tone: "info", title: `${rejecting.label} sent back to the vendor` });
            setRejecting(null);
            onChanged();
          }
        }}
      />
    </Card>
  );
}
