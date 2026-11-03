"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Clock, ShieldCheck } from "lucide-react";
import { api, useMutation } from "@/shared/lib/api";
import { Button, Card, CardHeader, cx, Notice } from "@/shared/ui/primitives";
import { useToast } from "@/shared/ui/overlay";

export type ApprovalMode = "Manual" | "Timed" | "Auto";

const modes: { value: ApprovalMode; icon: typeof ShieldCheck; title: string; body: string }[] = [
  { value: "Manual", icon: ShieldCheck, title: "Manual", body: "Staff approve every listing before it goes live." },
  { value: "Timed", icon: Clock, title: "After 24 hours", body: "Goes live 24 hours after the vendor submits it, unless staff review it sooner." },
  { value: "Auto", icon: BadgeCheck, title: "Automatic", body: "Goes live as soon as it's submitted. For vendors you trust; you can still suspend any listing." },
];

/** How a vendor's new and edited listings go live, set by staff who manage vendors. */
export function ListingApproval({ vendorId, mode, canEdit, onSaved }: { vendorId: string; mode: ApprovalMode; canEdit: boolean; onSaved: () => void }) {
  const [choice, setChoice] = useState<ApprovalMode>(mode);
  useEffect(() => setChoice(mode), [mode]);
  const toast = useToast();
  const save = useMutation(() => api<{ productApproval: ApprovalMode; waiting: number }>(`/admin/vendors/${vendorId}/product-approval`, { method: "PUT", body: { mode: choice } }));

  return (
    <Card>
      <CardHeader title="Listing approval" description="How this vendor's new and edited listings go live. The vendor is told when it changes." />
      <fieldset disabled={!canEdit} className="grid gap-2 p-4 sm:grid-cols-3">
        <legend className="sr-only">Listing approval</legend>
        {modes.map((m) => (
          <label key={m.value} className={cx("flex cursor-pointer flex-col gap-1 rounded-xl p-3 text-sm ring-1 ring-inset", choice === m.value ? "bg-plum-50 ring-plum-400" : "ring-ink-200", !canEdit && "cursor-default")}>
            <span className="flex items-center gap-2 font-semibold">
              <input type="radio" name="listing-approval" className="accent-plum-700" checked={choice === m.value} onChange={() => setChoice(m.value)} />
              <m.icon className="size-4 text-plum-600" aria-hidden /> {m.title}
            </span>
            <span className="text-xs text-ink-500">{m.body}</span>
          </label>
        ))}
      </fieldset>
      {canEdit && choice !== mode && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 px-4 py-3">
          <p className="text-xs text-ink-500">
            {choice === "Timed" ? "Listings already waiting get 24 hours from now." : choice === "Auto" ? "Listings already waiting stay in the review queue; new ones skip it." : "Listings already waiting stop going live by themselves."}
          </p>
          <Button
            size="sm"
            loading={save.pending}
            onClick={async () => {
              const r = await save.run();
              if (r) {
                toast({ tone: "success", title: "Listing approval updated", body: r.waiting ? `${r.waiting} waiting listing${r.waiting === 1 ? "" : "s"} follow the new setting.` : undefined });
                onSaved();
              }
            }}
          >
            Save
          </Button>
        </div>
      )}
      {!canEdit && <p className="px-4 pb-4 text-xs text-ink-500">Only staff who manage vendors can change this.</p>}
      {save.error && <Notice className="mx-4 mb-4" tone="danger">{save.error.message}</Notice>}
    </Card>
  );
}

/** "Goes live in 5h" for a listing waiting out its 24 hours. */
export function autoApproveLabel(at: string | null | undefined) {
  if (!at) return null;
  const hours = Math.max(0, Math.ceil((new Date(at).getTime() - Date.now()) / 3_600_000));
  return hours <= 0 ? "Going live shortly" : `Goes live in ${hours}h unless reviewed`;
}
