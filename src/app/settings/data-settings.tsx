"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, useApi, useMutation } from "@/shared/lib/api";
import { Button, Card, CardHeader, Field, Input, Notice } from "@/shared/ui/primitives";
import { moneyIn } from "@/shared/lib/format";
import { ConfirmDialog, Modal, useToast } from "@/shared/ui/overlay";

type Rate = { code: string; name: string; perUsd: number; updatedAt: string };

/** Currency rates people can choose from in every app (units per US dollar). Staff with settings access can add currencies, change
 * rates and remove ones nothing is priced in; every app picks up the list from the API. */
export function CurrencySettings() {
  const { data, error, reload } = useApi<{ currencies: Rate[]; canEdit: boolean }>("/admin/currencies");
  const [rates, setRates] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Rate | null>(null);
  const toast = useToast();
  const save = useMutation(() => api("/admin/currencies", { method: "PUT", body: Object.entries(rates).map(([code, v]) => ({ code, perUsd: Number(v) })) }));
  const remove = useMutation((code: string) => api(`/admin/currencies/${code}`, { method: "DELETE" }));
  useEffect(() => { if (data) setRates(Object.fromEntries(data.currencies.map((c) => [c.code, String(c.perUsd)]))); }, [data]);
  if (!data) return error ? <Notice tone="danger" className="mt-6">{error.message}</Notice> : null;
  const invalid = Object.entries(rates).some(([code, v]) => !(Number(v) > 0) || (code === "USD" && Number(v) !== 1));

  return (
    <Card className="mt-6">
      <CardHeader
        title="Currencies"
        description="Each app defaults to the viewer's local currency. Senders can budget surprises, and recipients can set wishlists, in any of these. Amounts are stored in USD; these rates convert them."
        action={data.canEdit && <Button size="sm" variant="secondary" icon={Plus} onClick={() => setAdding(true)}>Add currency</Button>}
      />
      <fieldset disabled={!data.canEdit} className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
        {data.currencies.map((c) => (
          <div key={c.code} className="text-xs font-semibold text-ink-700">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor={`rate-${c.code}`}>{c.code} · {c.name}</label>
              {data.canEdit && !required.includes(c.code) && (
                <button type="button" className="rounded p-0.5 text-ink-400 hover:text-danger-700" aria-label={`Remove ${c.code}`} onClick={() => setRemoving(c)}>
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              )}
            </div>
            <span className="mt-1 flex items-center gap-2">
              <Input id={`rate-${c.code}`} type="number" step="0.0001" min={0} value={rates[c.code] ?? ""} disabled={c.code === "USD"} onChange={(e) => setRates({ ...rates, [c.code]: e.target.value })} />
              <span className="shrink-0 font-normal text-ink-500">per $1</span>
            </span>
          </div>
        ))}
      </fieldset>
      {data.canEdit && (
        <div className="flex items-center justify-end gap-2 border-t border-ink-100 px-5 py-3">
          {save.error && <p className="text-xs text-danger-700">{save.error.message}</p>}
          <Button disabled={invalid} loading={save.pending} onClick={async () => { if (await save.run()) { toast({ tone: "success", title: "Currency rates saved" }); reload(); } }}>Save rates</Button>
        </div>
      )}
      <AddCurrencyModal open={adding} taken={data.currencies.map((c) => c.code)} onClose={() => setAdding(false)} onAdded={(code) => { setAdding(false); toast({ tone: "success", title: `${code} added`, body: "It's now available in every app." }); reload(); }} />
      <ConfirmDialog
        open={!!removing}
        onClose={() => { setRemoving(null); remove.setError(null); }}
        title={`Remove ${removing?.code}?`}
        description="People will no longer be able to choose it. Currencies that wishlists or surprise requests are priced in can't be removed."
        confirmLabel="Remove currency"
        tone="danger"
        pending={remove.pending}
        error={remove.error?.message}
        onConfirm={async () => {
          if (removing && (await remove.run(removing.code)) !== undefined) {
            toast({ tone: "success", title: `${removing.code} removed` });
            setRemoving(null);
            reload();
          }
        }}
      />
    </Card>
  );
}

/** USD (what amounts are stored in) and NGN (the launch market) are always offered. */
const required = ["USD", "NGN"];

/** The English name of an ISO 4217 code, or null if the browser doesn't know it as a currency. */
function currencyName(code: string) {
  try {
    const name = new Intl.DisplayNames(["en"], { type: "currency" }).of(code);
    return name && name !== code ? name : null;
  } catch {
    return null;
  }
}

function AddCurrencyModal({ open, taken, onClose, onAdded }: { open: boolean; taken: string[]; onClose: () => void; onAdded: (code: string) => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const add = useMutation(() => api("/admin/currencies", { method: "POST", body: { code, name, perUsd: Number(rate) } }));
  const known = code.length === 3 ? currencyName(code) : null;
  const codeError = code.length === 3 && taken.includes(code) ? `${code} is already offered.` : code.length === 3 && !known ? "That isn't a currency code we recognise." : null;
  const valid = code.length === 3 && !codeError && name.trim().length >= 2 && Number(rate) > 0;
  const reset = () => { setCode(""); setName(""); setRate(""); add.setError(null); };

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="Add a currency"
      description="It appears in every app's currency switcher, and for wishlists and surprise budgets. Amounts are still stored in USD."
      footer={
        <>
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button icon={Plus} disabled={!valid} loading={add.pending} onClick={async () => { if ((await add.run()) !== undefined) { onAdded(code); reset(); } }}>Add currency</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <Field label="ISO code" error={codeError ?? add.error?.errors?.code?.[0]} hint="e.g. XOF, AED">
          {(id, d) => (
            <Input
              id={id}
              aria-describedby={d}
              value={code}
              maxLength={3}
              className="font-mono uppercase"
              onChange={(e) => {
                const next = e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
                setCode(next);
                // Fill in the name the first time a recognised code is typed.
                const n = next.length === 3 ? currencyName(next) : null;
                if (n && (!name || name === currencyName(code))) setName(n);
              }}
            />
          )}
        </Field>
        <Field label="Name" error={add.error?.errors?.name?.[0]}>
          {(id, d) => <Input id={id} aria-describedby={d} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="West African CFA franc" />}
        </Field>
      </div>
      <Field label="Rate" className="mt-4" error={add.error?.errors?.perUsd?.[0]} hint={known && Number(rate) > 0 ? `$1 = ${moneyIn(Number(rate), code)} · $100 = ${moneyIn(Number(rate) * 100, code)}` : "How many units buy one US dollar."}>
        {(id, d) => (
          <span className="flex items-center gap-2">
            <Input id={id} aria-describedby={d} type="number" step="0.0001" min={0} value={rate} onChange={(e) => setRate(e.target.value)} />
            <span className="shrink-0 text-sm text-ink-500">per $1</span>
          </span>
        )}
      </Field>
      {add.error && !add.error.errors && <Notice className="mt-4" tone="danger">{add.error.message}</Notice>}
    </Modal>
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
