"use client";

import { useEffect, useState } from "react";
import { api, useApi, useMutation } from "@/shared/lib/api";
import Link from "next/link";
import { Button, Card, CardHeader, ErrorState, Field, Input, Notice, PageHeader, PageSkeleton, Switch } from "@/shared/ui/primitives";
import { ConfirmDialog, useToast } from "@/shared/ui/overlay";
import { EmailDeliverySettings } from "./email-settings";
import { CurrencySettings, SampleDataSettings } from "./data-settings";

type Settings = { id: string; commissionRate: number; fxRateNgn: number; payoutHoldDays: number; freeSampleLimitUsd: number; taxRate: number; verificationCodeTtlHours: number; verificationMaxAttempts: number; requireDeliveryEvidenceForPayout: boolean; cashGiftFeeRate: number };
type Data = { settings: Settings; canEdit: boolean };

export default function SettingsPage() {
  const { data, error, loading, reload } = useApi<Data>("/admin/settings");
  const toast = useToast();
  const [form, setForm] = useState<Settings | null>(null);
  const [confirm, setConfirm] = useState(false);
  const save = useMutation((s: Settings) => api<Settings>("/admin/settings", { method: "PUT", body: s }));
  useEffect(() => { if (data) setForm(data.settings); }, [data]);
  if (loading || !form) return error ? <ErrorState error={error} onRetry={reload} /> : <PageSkeleton />;
  const editable = data!.canEdit;
  const num = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: Number(e.target.value) });
  const errs = {
    commission: form.commissionRate < 0 || form.commissionRate > 0.5 ? "Between 0% and 50%." : null,
    hold: form.payoutHoldDays < 0 || form.payoutHoldDays > 30 ? "Between 0 and 30 days." : null,
    fx: form.fxRateNgn <= 0 ? "Must be positive." : null,
    attempts: form.verificationMaxAttempts < 1 || form.verificationMaxAttempts > 10 ? "Between 1 and 10." : null,
    cashFee: form.cashGiftFeeRate < 0 || form.cashGiftFeeRate > 0.3 ? "Between 0% and 30%." : null,
  };
  const invalid = Object.values(errs).some(Boolean);

  return (
    <>
      <PageHeader title="Settings" description="Business rules that drive payouts, pricing display and verification. Changes are audited." />
      {!editable && <Notice className="mb-6">You can view settings. Your team role doesn't include changing them.</Notice>}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Marketplace rules" />
          <fieldset disabled={!editable} className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Commission rate (%)" error={errs.commission} hint="Applied to the product subtotal.">
              {(id, d) => <Input id={id} aria-describedby={d} type="number" step="0.5" value={+(form.commissionRate * 100).toFixed(2)} onChange={(e) => setForm({ ...form, commissionRate: Number(e.target.value) / 100 })} />}
            </Field>
            <Field label="Cash gift fee (%)" error={errs.cashFee} hint="Paid by the sender on top of the cash amount.">
              {(id, d) => <Input id={id} aria-describedby={d} type="number" step="0.5" value={+(form.cashGiftFeeRate * 100).toFixed(2)} onChange={(e) => setForm({ ...form, cashGiftFeeRate: Number(e.target.value) / 100 })} />}
            </Field>
            <Field label="Payout hold after delivery (days)" error={errs.hold}>
              {(id, d) => <Input id={id} aria-describedby={d} type="number" value={form.payoutHoldDays} onChange={num("payoutHoldDays")} />}
            </Field>
            <Field label="Display FX rate (₦ per $1)" error={errs.fx} hint="Sample rate. Production would use a provider rate feed and record it per order.">
              {(id, d) => <Input id={id} aria-describedby={d} type="number" value={form.fxRateNgn} onChange={num("fxRateNgn")} />}
            </Field>
            <Field label="Free first gift limit (USD)" hint="Fixed by pricing policy.">
              {(id, d) => <Input id={id} aria-describedby={d} value={form.freeSampleLimitUsd} disabled readOnly />}
            </Field>
            <div className="sm:col-span-2">
              <Switch checked={form.requireDeliveryEvidenceForPayout} onChange={(v) => setForm({ ...form, requireDeliveryEvidenceForPayout: v })} label="Require delivery evidence for payout" description="Orders without a verified code or courier proof are never paid out." disabled={!editable} />
            </div>
          </fieldset>
        </Card>
        <Card>
          <CardHeader title="Secret-code verification" />
          <fieldset disabled={!editable} className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Code lifetime (hours)">{(id) => <Input id={id} type="number" value={form.verificationCodeTtlHours} onChange={num("verificationCodeTtlHours")} />}</Field>
            <Field label="Max attempts before lockout" error={errs.attempts}>{(id, d) => <Input id={id} aria-describedby={d} type="number" value={form.verificationMaxAttempts} onChange={num("verificationMaxAttempts")} />}</Field>
            <p className="text-xs text-ink-500 sm:col-span-2">Lockout lasts 15 minutes; requests are also rate-limited to 10 per minute per user at the API.</p>
          </fieldset>
          {editable && (
            <div className="flex justify-end gap-2 border-t border-ink-100 px-5 py-3">
              <Button variant="ghost" onClick={() => setForm(data!.settings)}>Reset</Button>
              <Button disabled={invalid} onClick={() => setConfirm(true)}>Save changes</Button>
            </div>
          )}
        </Card>
      </div>
      <CurrencySettings />
      <EmailDeliverySettings />
      <SampleDataSettings />
      <Notice className="mt-6" title="Who can do what">
        Team roles and their privileges are managed by super admins in{" "}
        <Link href="/roles" className="font-semibold text-plum-700 underline">Roles &amp; Privileges</Link>.
      </Notice>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Save platform settings?"
        description="These rules apply immediately to payout eligibility, verification and price display across every dashboard. The change is recorded in the audit log."
        confirmLabel="Save settings"
        pending={save.pending}
        error={save.error?.message}
        onConfirm={async () => {
          if (await save.run(form)) {
            toast({ tone: "success", title: "Settings saved" });
            setConfirm(false);
          }
        }}
      />
    </>
  );
}
