"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { api, useApi, useMutation } from "@/shared/lib/api";
import { Button, Card, CardHeader, Input, Notice } from "@/shared/ui/primitives";
import { ConfirmDialog, useToast } from "@/shared/ui/overlay";

type Rate = { code: string; name: string; perUsd: number; updatedAt: string };

/** Currency rates people can choose from in every app (units per US dollar). */
export function CurrencySettings() {
  const { data, error, reload } = useApi<{ currencies: Rate[]; canEdit: boolean }>("/admin/currencies");
  const [rates, setRates] = useState<Record<string, string>>({});
  const toast = useToast();
  const save = useMutation(() => api("/admin/currencies", { method: "PUT", body: Object.entries(rates).map(([code, v]) => ({ code, perUsd: Number(v) })) }));
  useEffect(() => { if (data) setRates(Object.fromEntries(data.currencies.map((c) => [c.code, String(c.perUsd)]))); }, [data]);
  if (!data) return error ? <Notice tone="danger" className="mt-6">{error.message}</Notice> : null;
  const invalid = Object.entries(rates).some(([code, v]) => !(Number(v) > 0) || (code === "USD" && Number(v) !== 1));

  return (
    <Card className="mt-6">
      <CardHeader title="Currencies" description="Each app defaults to the viewer's local currency. Senders can budget surprises, and recipients can set wishlists, in any of these. Amounts are stored in USD; these sample rates convert them." />
      <fieldset disabled={!data.canEdit} className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
        {data.currencies.map((c) => (
          <label key={c.code} className="block text-xs font-semibold text-ink-700">
            {c.code} · {c.name}
            <span className="mt-1 flex items-center gap-2">
              <Input type="number" step="0.0001" min={0} value={rates[c.code] ?? ""} disabled={c.code === "USD"} onChange={(e) => setRates({ ...rates, [c.code]: e.target.value })} />
              <span className="shrink-0 font-normal text-ink-500">per $1</span>
            </span>
          </label>
        ))}
      </fieldset>
      {data.canEdit && (
        <div className="flex items-center justify-end gap-2 border-t border-ink-100 px-5 py-3">
          {save.error && <p className="text-xs text-danger-700">{save.error.message}</p>}
          <Button disabled={invalid} loading={save.pending} onClick={async () => { if (await save.run()) { toast({ tone: "success", title: "Currency rates saved" }); reload(); } }}>Save rates</Button>
        </div>
      )}
    </Card>
  );
}

/** Lets a super admin delete the sample data the demo seeded, keeping real accounts. */
export function SampleDataSettings() {
  const { data, reload } = useApi<{ people: number; stores: number; canRemove: boolean }>("/admin/settings/sample-data");
  const [confirm, setConfirm] = useState(false);
  const toast = useToast();
  const remove = useMutation(() => api<{ users: number; vendors: number; orders: number }>("/admin/settings/remove-sample-data", { method: "POST" }));
  if (!data || (data.people === 0 && data.stores === 0)) return null;

  return (
    <Card className="mt-6">
      <CardHeader title="Sample data" description={`${data.people} sample people and ${data.stores} sample stores (on example.com addresses) are still in the database, with their orders, wishlists and requests.`} />
      <div className="flex flex-wrap items-center justify-between gap-3 p-5">
        <p className="max-w-2xl text-sm text-ink-700">
          Removing it leaves only real accounts. Anything done while signed in as a sample persona goes too, as do real orders from sample stores. New sample data is no longer loaded.
        </p>
        {data.canRemove ? (
          <Button variant="secondary" icon={Trash2} onClick={() => setConfirm(true)}>Remove sample data</Button>
        ) : (
          <p className="text-xs text-ink-500">Only super admins can remove it.</p>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Remove all sample data?"
        description="This permanently deletes the sample people, stores, products, orders, wishlists, requests, tickets and their history. Real accounts and categories stay. This can't be undone."
        confirmLabel="Remove sample data"
        tone="danger"
        pending={remove.pending}
        error={remove.error?.message}
        onConfirm={async () => {
          const r = await remove.run();
          if (r) {
            toast({ tone: "success", title: "Sample data removed", body: `${r.users} people, ${r.vendors} stores and ${r.orders} orders deleted.` });
            setConfirm(false);
            reload();
          }
        }}
      />
    </Card>
  );
}
