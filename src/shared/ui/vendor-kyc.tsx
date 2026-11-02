"use client";

import { useState } from "react";
import { BadgeCheck, Clock, FileUp, ShieldCheck, TriangleAlert } from "lucide-react";
import { api, useApi, useMutation } from "../lib/api";
import { Badge, Button, ErrorState, Field, Input, Notice, Select, Spinner } from "./primitives";

type Check = {
  kind: "Business" | "Bank" | "Identity"; label: string; asks: string; status: "NotSubmitted" | "Submitted" | "Verified" | "Rejected";
  reference: string | null; detail: string | null; hasDocument: boolean; documentName: string | null; reviewNote: string | null; onFile: boolean;
};
type Kyc = { status: string; idTypes: string[]; kyc: { readyForReview: boolean; allVerified: boolean; checks: Check[] } };

const banks = [
  "Access Bank", "Citibank", "Ecobank", "Fidelity Bank", "First Bank", "FCMB", "Globus Bank", "GTBank", "Heritage Bank", "Jaiz Bank", "Keystone Bank",
  "Kuda", "Moniepoint", "OPay", "PalmPay", "Polaris Bank", "Providus Bank", "Stanbic IBTC", "Standard Chartered", "Sterling Bank", "SunTrust Bank",
  "Titan Trust Bank", "Union Bank", "UBA", "Unity Bank", "Wema Bank", "Zenith Bank",
];

const statusBadge: Record<Check["status"], { label: string; tone: "neutral" | "warning" | "success" | "danger"; icon: typeof Clock }> = {
  NotSubmitted: { label: "Not submitted", tone: "neutral", icon: FileUp },
  Submitted: { label: "Awaiting review", tone: "warning", icon: Clock },
  Verified: { label: "Verified", tone: "success", icon: BadgeCheck },
  Rejected: { label: "Needs changes", tone: "danger", icon: TriangleAlert },
};

type Upload = { fileName: string; dataBase64: string } | null;

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function FilePicker({ id, onChange, error }: { id: string; onChange: (u: Upload, error?: string) => void; error?: string }) {
  return (
    <input
      id={id}
      type="file"
      accept="application/pdf,image/jpeg,image/png,image/webp"
      aria-invalid={!!error}
      className="block w-full text-sm text-ink-700 file:mr-3 file:rounded-full file:border-0 file:bg-plum-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-plum-700"
      onChange={async (e) => {
        const f = e.target.files?.[0];
        if (!f) return onChange(null);
        if (f.size > 5 * 1024 * 1024) return onChange(null, "Files must be 5 MB or smaller.");
        onChange({ fileName: f.name, dataBase64: await readFile(f) });
      }}
    />
  );
}

/** One verification check: what was sent, the reviewer's note, and the form to submit or resubmit it. */
function CheckCard({ check, idTypes, onSaved }: { check: Check; idTypes: string[]; onSaved: (k: Kyc) => void }) {
  const [editing, setEditing] = useState(check.status === "NotSubmitted" || check.status === "Rejected");
  const [form, setForm] = useState({ number: "", bankName: banks[0], accountNumber: "", accountName: "", idType: idTypes[0] ?? "NIN" });
  const [file, setFile] = useState<Upload>(null);
  const [fileError, setFileError] = useState<string>();
  const path = check.kind.toLowerCase();
  const save = useMutation(() =>
    api<Kyc>(`/vendor-application/kyc/${path}`, {
      method: "PUT",
      body:
        check.kind === "Business" ? { registrationNumber: form.number, document: file }
        : check.kind === "Bank" ? { bankName: form.bankName, accountNumber: form.accountNumber, accountName: form.accountName }
        : { idType: form.idType, idNumber: form.number, document: file },
    }),
  );
  const fieldError = (name: string) => save.error?.errors?.[name]?.[0];
  const b = statusBadge[check.status];
  const needsFile = check.kind !== "Bank";

  return (
    <li className="rounded-2xl border border-ink-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-plum-900">{check.label}</p>
          <p className="text-xs text-ink-500">{check.asks}</p>
        </div>
        <Badge tone={b.tone} icon={b.icon}>{b.label}</Badge>
      </div>
      {check.status === "Rejected" && check.reviewNote && <Notice tone="danger" className="mt-3" title="What to fix">{check.reviewNote}</Notice>}
      {check.reference && !editing && (
        <p className="mt-2 text-xs text-ink-700">
          {check.detail} · {check.reference}
          {check.documentName && <> · {check.documentName}</>}
        </p>
      )}
      {check.onFile && <p className="mt-2 text-xs text-ink-500">Verified when your store was set up.</p>}
      {editing ? (
        <form
          className="mt-3 grid gap-3 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await save.run();
            if (r) {
              setEditing(false);
              setFile(null);
              onSaved(r);
            }
          }}
        >
          {check.kind === "Business" && (
            <Field label="CAC number" required error={fieldError("registrationNumber")} hint="RC or BN number on your certificate">
              {(id, d) => <Input id={id} aria-describedby={d} value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="RC1234567" autoComplete="off" />}
            </Field>
          )}
          {check.kind === "Bank" && (
            <>
              <Field label="Bank" required error={fieldError("bankName")}>
                {(id) => <Select id={id} value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })}>{banks.map((x) => <option key={x}>{x}</option>)}</Select>}
              </Field>
              <Field label="Account number" required error={fieldError("accountNumber")}>
                {(id, d) => <Input id={id} aria-describedby={d} inputMode="numeric" maxLength={10} value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value.replace(/\D/g, "") })} placeholder="0123456789" autoComplete="off" />}
              </Field>
              <Field label="Account name" required error={fieldError("accountName")} className="sm:col-span-2" hint="As it appears at your bank. Payouts only go to this account.">
                {(id, d) => <Input id={id} aria-describedby={d} value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} autoComplete="off" />}
              </Field>
            </>
          )}
          {check.kind === "Identity" && (
            <>
              <Field label="Type of ID" required error={fieldError("idType")}>
                {(id) => <Select id={id} value={form.idType} onChange={(e) => setForm({ ...form, idType: e.target.value })}>{idTypes.map((x) => <option key={x}>{x}</option>)}</Select>}
              </Field>
              <Field label="ID number" required error={fieldError("idNumber")}>
                {(id, d) => <Input id={id} aria-describedby={d} value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} autoComplete="off" />}
              </Field>
            </>
          )}
          {needsFile && (
            <Field label={check.kind === "Business" ? "Registration certificate" : "Photo or scan of the ID"} required={!check.hasDocument} error={fileError ?? fieldError("document")} className="sm:col-span-2" hint={check.hasDocument ? "Leave empty to keep the file you sent." : "PDF, JPG, PNG or WebP, up to 5 MB."}>
              {(id) => <FilePicker id={id} error={fileError} onChange={(u, err) => { setFile(u); setFileError(err); }} />}
            </Field>
          )}
          {save.error && !save.error.errors && <Notice tone="danger" className="sm:col-span-2">{save.error.message}</Notice>}
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" size="sm" loading={save.pending} disabled={!!fileError}>Submit</Button>
            {check.status !== "NotSubmitted" && check.status !== "Rejected" && <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>}
          </div>
        </form>
      ) : (
        check.status === "Submitted" && <Button size="sm" variant="ghost" className="mt-2" onClick={() => setEditing(true)}>Replace</Button>
      )}
    </li>
  );
}

/**
 * The vendor's verification checklist (business registration, bank account, owner ID). Shown while a store application is
 * pending, and to stores approved before verification existed. The store is reviewed once all three are submitted.
 */
export function VendorVerification({ storeName }: { storeName: string }) {
  const { data: fetched, error, loading, reload } = useApi<Kyc>("/vendor-application/kyc");
  const [saved, setSaved] = useState<Kyc | null>(null);
  const data = saved ?? fetched;
  if (loading && !data) return <Spinner label="Loading verification" />;
  if (!data) return <ErrorState error={error} onRetry={reload} />;
  const { checks, readyForReview, allVerified } = data.kyc;
  const done = checks.filter((c) => c.status === "Submitted" || c.status === "Verified").length;
  const pending = data.status === "Pending";

  return (
    <section aria-labelledby="kyc-title">
      <h1 id="kyc-title" className="mt-6 font-display text-2xl font-semibold text-plum-900">
        {allVerified ? "Your store is verified" : readyForReview && pending ? "Your store is under review" : "Verify your business"}
      </h1>
      <p className="mt-2 text-sm text-ink-500">
        {readyForReview && pending
          ? <>Thanks, we have everything for <strong>{storeName}</strong>. Our team is checking your documents and will notify you as soon as your store is approved.</>
          : <>To protect customers and pay you safely, every store is verified before it can sell. Submit these three checks and we&apos;ll review <strong>{storeName}</strong>.</>}
      </p>
      <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-plum-700">
        <ShieldCheck className="size-4" aria-hidden /> {done} of {checks.length} submitted · your details are encrypted and only seen by the SecretWish verification team
      </p>
      <ul className="mt-4 space-y-3">
        {checks.map((c) => (
          <CheckCard key={`${c.kind}-${c.status}`} check={c} idTypes={data.idTypes} onSaved={setSaved} />
        ))}
      </ul>
    </section>
  );
}
