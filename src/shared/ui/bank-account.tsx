"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Globe2 } from "lucide-react";
import { api, ApiError, useApi, useMutation } from "../lib/api";
import { Button, Field, Input, Notice, Select } from "./primitives";
import { useToast } from "./overlay";

type Bank = { code: string; name: string };
type BankOptions = { engine: string | null; banks: Bank[]; stripeConnect: boolean; error?: string };

const stripeCountries: [string, string][] = [
  ["GB", "United Kingdom"], ["US", "United States"], ["CA", "Canada"], ["IE", "Ireland"], ["DE", "Germany"], ["FR", "France"], ["NL", "Netherlands"],
  ["ES", "Spain"], ["IT", "Italy"], ["AU", "Australia"], ["AE", "United Arab Emirates"], ["ZA", "South Africa"],
];

/**
 * Bank details for receiving money (a recipient's cash gifts or a store's payouts). When SecretWish has a payout engine for Nigerian
 * banks, the bank is chosen from its list and the account name comes from the bank itself, so money can't go to a mistyped account;
 * otherwise the details are typed in. People outside Nigeria can set up payouts with Stripe instead (connectFor).
 */
export function BankAccountForm({ endpoint, connectFor, onSaved, onCancel, submitLabel = "Save bank details", cancelLabel = "Cancel" }: {
  /** e.g. "/recipient/payout-account" or "/vendor/payout-account" (PUT). */
  endpoint: string;
  connectFor?: "me" | "store";
  onSaved: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
}) {
  const toast = useToast();
  const { data: options } = useApi<BankOptions>("/payments/banks?country=NG");
  const checked = !!options?.engine && options.banks.length > 0;
  const [form, setForm] = useState({ bankCode: "", bankName: "", accountName: "", accountNumber: "" });
  const [resolved, setResolved] = useState<string | null>(null);
  const [abroad, setAbroad] = useState(false);
  const [country, setCountry] = useState("GB");
  const resolve = useMutation((bankCode: string, accountNumber: string) =>
    api<{ accountName: string }>("/payments/resolve-account", { method: "POST", body: { bankCode, accountNumber } }));
  const save = useMutation(() => api(endpoint, { method: "PUT", body: { ...form, country: "NG" } }));
  const onboard = useMutation(() => api<{ url: string }>("/payments/connect/onboard", { method: "POST", body: { for: connectFor, country } }));
  const err = (k: string) => (save.error instanceof ApiError ? save.error.errors?.[k]?.[0] : undefined);

  // Look the account up as soon as there's a bank and 10 digits.
  const digits = form.accountNumber.replace(/\D/g, "");
  useEffect(() => {
    setResolved(null);
    resolve.setError(null);
    if (!checked || !form.bankCode || digits.length !== 10) return;
    const t = setTimeout(async () => {
      const r = await resolve.run(form.bankCode, digits);
      if (r) setResolved(r.accountName);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, form.bankCode, digits]);

  if (abroad && connectFor)
    return (
      <div className="grid gap-3">
        <p className="text-sm text-ink-700">Outside Nigeria? Stripe pays you in your own currency. You&apos;ll set up your account on Stripe&apos;s secure pages and come back here.</p>
        <Field label="Where's your bank account?">
          {(id) => <Select id={id} value={country} onChange={(e) => setCountry(e.target.value)}>{stripeCountries.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</Select>}
        </Field>
        {onboard.error && <Notice tone="danger">{onboard.error.message}</Notice>}
        <div className="flex flex-wrap gap-2">
          <Button icon={Globe2} loading={onboard.pending} onClick={async () => { const r = await onboard.run(); if (r) window.location.assign(r.url); }}>Continue to Stripe</Button>
          <Button variant="ghost" onClick={() => setAbroad(false)}>Use a Nigerian bank instead</Button>
        </div>
      </div>
    );

  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await save.run()) {
          toast({ tone: "success", title: "Bank details saved", body: "Money will be sent to this account." });
          setForm({ bankCode: "", bankName: "", accountName: "", accountNumber: "" });
          onSaved();
        }
      }}
    >
      {checked ? (
        <>
          <Field label="Bank" error={err("bankCode")}>
            {(id) => (
              <Select id={id} required value={form.bankCode} onChange={(e) => setForm({ ...form, bankCode: e.target.value })}>
                <option value="">Choose your bank…</option>
                {options!.banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Account number" error={err("accountNumber") ?? resolve.error?.errors?.accountNumber?.[0]} hint="Your 10-digit NUBAN.">
            {(id, d) => <Input id={id} aria-describedby={d} required inputMode="numeric" autoComplete="off" maxLength={10} value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value.replace(/\D/g, "") })} />}
          </Field>
          {resolve.pending && <p className="text-xs text-ink-500">Checking the account with your bank…</p>}
          {resolved && (
            <p className="flex items-center gap-1.5 rounded-xl bg-success-50 px-3 py-2 text-sm text-success-700">
              <CheckCircle2 className="size-4" aria-hidden /> Account name: <b>{resolved}</b>
            </p>
          )}
        </>
      ) : (
        <>
          {options?.error && <Notice tone="warning">{options.error} You can still type your details in.</Notice>}
          <Field label="Bank" error={err("bankName")}>{(id) => <Input id={id} required maxLength={80} value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="e.g. GTBank" />}</Field>
          <Field label="Name on the account" error={err("accountName")}>{(id) => <Input id={id} required maxLength={120} autoComplete="name" value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} />}</Field>
          <Field label="Account number" error={err("accountNumber")} hint="Nigerian accounts (NUBAN) have 10 digits.">
            {(id, d) => <Input id={id} aria-describedby={d} required inputMode="numeric" autoComplete="off" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} />}
          </Field>
        </>
      )}
      {save.error && !save.error.errors && <Notice tone="danger">{save.error.message}</Notice>}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" loading={save.pending} disabled={checked && !resolved}>{submitLabel}</Button>
        {onCancel && <Button variant="ghost" onClick={onCancel}>{cancelLabel}</Button>}
        {connectFor && options?.stripeConnect && (
          <button type="button" className="ml-auto text-xs font-semibold text-plum-700 hover:underline" onClick={() => setAbroad(true)}>Bank outside Nigeria?</button>
        )}
      </div>
    </form>
  );
}
