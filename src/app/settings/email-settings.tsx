"use client";

import { useEffect, useState } from "react";
import { Mail, Send } from "lucide-react";
import { api, useApi, useMutation } from "@/shared/lib/api";
import { dateTime } from "@/shared/lib/format";
import { Badge, Button, Card, CardHeader, ErrorState, Field, Input, Notice, Select, Spinner } from "@/shared/ui/primitives";
import { useToast } from "@/shared/ui/overlay";

type Provider = "Resend" | "Postmark" | "SendGrid" | "Mailgun";
type EmailSettings = {
  provider: Provider;
  from: string;
  /** While "from" is Resend's test sender, every email goes to this inbox; redirecting = that's happening now. */
  testRecipient: string | null;
  redirecting: boolean;
  saved: { resend: string | null; postmark: string | null; sendGrid: string | null; mailgun: string | null };
  mailgunDomain: string | null;
  mailgunRegion: string;
  ready: string[];
  updatedAt: string | null;
  updatedBy: string | null;
  canEdit: boolean;
};

const providers: { value: Provider; label: string; secretLabel: string; secretKey: "resendApiKey" | "postmarkServerToken" | "sendGridApiKey" | "mailgunApiKey"; savedKey: keyof EmailSettings["saved"]; help: string }[] = [
  { value: "Resend", label: "Resend (default)", secretLabel: "API key", secretKey: "resendApiKey", savedKey: "resend", help: "resend.com → API Keys. Verify your sending domain under Domains." },
  { value: "Postmark", label: "Postmark", secretLabel: "Server API token", secretKey: "postmarkServerToken", savedKey: "postmark", help: "postmarkapp.com → your server → API Tokens. Add your domain as a Sender Signature." },
  { value: "SendGrid", label: "SendGrid", secretLabel: "API key (Mail Send)", secretKey: "sendGridApiKey", savedKey: "sendGrid", help: "sendgrid.com → Settings → API Keys. Authenticate your domain under Sender Authentication." },
  { value: "Mailgun", label: "Mailgun", secretLabel: "API key", secretKey: "mailgunApiKey", savedKey: "mailgun", help: "mailgun.com → API Security. Use the sending domain you verified in Mailgun." },
];

type TestResult = { provider: string; fellBack: boolean; outbox: boolean; to: string; redirected?: boolean };

/** Admin → Settings: choose which service sends SecretWish email. Resend is the default and the fallback if the chosen one fails. */
export function EmailDeliverySettings() {
  const { data, error, loading, reload } = useApi<EmailSettings>("/admin/settings/email");
  const toast = useToast();
  const [provider, setProvider] = useState<Provider>("Resend");
  const [from, setFrom] = useState("");
  const [testRecipient, setTestRecipient] = useState("");
  const [secret, setSecret] = useState("");
  const [resendKey, setResendKey] = useState("");
  const [domain, setDomain] = useState("");
  const [region, setRegion] = useState("US");
  const [test, setTest] = useState<TestResult | null>(null);
  useEffect(() => {
    if (!data) return;
    setProvider(data.provider);
    setFrom(data.from);
    setTestRecipient(data.testRecipient ?? "");
    setDomain(data.mailgunDomain ?? "");
    setRegion(data.mailgunRegion ?? "US");
  }, [data]);

  const meta = providers.find((p) => p.value === provider)!;
  const save = useMutation(() =>
    api("/admin/settings/email", {
      method: "PUT",
      body: {
        provider, from, testRecipient,
        [meta.secretKey]: secret || null,
        ...(provider !== "Resend" ? { resendApiKey: resendKey || null } : {}),
        mailgunDomain: provider === "Mailgun" ? domain : null,
        mailgunRegion: region,
      },
    }),
  );
  const sendTest = useMutation(() => api<TestResult>("/admin/settings/email/test", { method: "POST" }));

  if (loading) return <Card className="mt-6"><Spinner /></Card>;
  if (error || !data) return <Card className="mt-6"><ErrorState error={error} onRetry={reload} /></Card>;
  const ready = data.ready.includes(provider);
  const testSender = /@resend\.dev>?\s*$/i.test(from.trim());

  return (
    <Card className="mt-6">
      <CardHeader
        title="Email delivery"
        description="Which service sends sign-in codes and other SecretWish email. If the chosen service fails, email is retried through Resend."
        action={<Badge tone={data.ready.length ? "success" : "warning"} icon={Mail}>{data.ready.length ? `Using ${data.ready.includes(data.provider) ? data.provider : "Resend"}` : "Not set up"}</Badge>}
      />
      <fieldset disabled={!data.canEdit} className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Provider">
          {(id) => (
            <Select id={id} value={provider} onChange={(e) => { setProvider(e.target.value as Provider); setSecret(""); }}>
              {providers.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Send from" hint="e.g. SecretWish <no-reply@mail.secretwish.com>, on a domain verified with the provider.">
          {(id, d) => <Input id={id} aria-describedby={d} value={from} onChange={(e) => setFrom(e.target.value)} />}
        </Field>
        {testSender && (
          <>
            <Notice className="sm:col-span-2" tone="warning" title="Sending from Resend's test address">
              onboarding@resend.dev only delivers to the email your Resend account uses, so every SecretWish email (sign-in codes, invites, thank-yous)
              goes to the test inbox below instead, marked with who it was for. Verify your domain at resend.com/domains and change “Send from” to
              an address on it to email people directly.
            </Notice>
            <Field label="Test inbox" hint="The email address of your Resend account.">
              {(id, d) => <Input id={id} aria-describedby={d} type="email" value={testRecipient} onChange={(e) => setTestRecipient(e.target.value)} placeholder="you@example.com" />}
            </Field>
          </>
        )}
        <Field label={`${meta.label.replace(" (default)", "")} ${meta.secretLabel}`} hint={data.saved[meta.savedKey] ? `Saved (${data.saved[meta.savedKey]}). Leave blank to keep it.` : meta.help}>
          {(id, d) => <Input id={id} aria-describedby={d} type="password" autoComplete="off" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={data.saved[meta.savedKey] ? "••••••••" : "Paste the key"} />}
        </Field>
        {provider === "Mailgun" && (
          <>
            <Field label="Mailgun sending domain">{(id) => <Input id={id} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="mail.secretwish.com" />}</Field>
            <Field label="Mailgun region">{(id) => <Select id={id} value={region} onChange={(e) => setRegion(e.target.value)}><option value="US">US</option><option value="EU">EU</option></Select>}</Field>
          </>
        )}
        {provider !== "Resend" && (
          <Field label="Resend API key (fallback)" hint={data.saved.resend ? `Saved (${data.saved.resend}). Leave blank to keep it.` : "Used if the provider above fails. Strongly recommended."}>
            {(id, d) => <Input id={id} aria-describedby={d} type="password" autoComplete="off" value={resendKey} onChange={(e) => setResendKey(e.target.value)} placeholder={data.saved.resend ? "••••••••" : "Paste the key"} />}
          </Field>
        )}
        {!ready && !secret && <Notice className="sm:col-span-2" tone="warning">{meta.value} has no credentials yet, so email will go through Resend{data.ready.includes("Resend") ? "" : " — which isn't set up either, so codes only appear in the server logs"}.</Notice>}
        {test && (
          <Notice className="sm:col-span-2" tone={test.outbox ? "warning" : test.fellBack ? "warning" : "success"}>
            {test.outbox ? `No provider is set up, so the test went to the server logs only.` : test.fellBack ? `${provider} failed, so the test was sent to ${test.to} through the Resend fallback. Check the ${provider} key.` : `Test email sent to ${test.to} via ${test.provider}${test.redirected ? " (the test inbox)" : ""}.`}
          </Notice>
        )}
        {(save.error || sendTest.error) && <Notice className="sm:col-span-2" tone="danger">{(save.error ?? sendTest.error)!.message}</Notice>}
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 px-5 py-3">
        <p className="text-xs text-ink-500">{data.updatedAt ? `Last changed ${dateTime(data.updatedAt)} by ${data.updatedBy}` : "Using the defaults."}</p>
        {data.canEdit && (
          <div className="flex gap-2">
            <Button variant="secondary" icon={Send} loading={sendTest.pending} onClick={async () => { setTest(null); const r = await sendTest.run(); if (r) setTest(r); }}>Send test email</Button>
            <Button loading={save.pending} onClick={async () => { if (await save.run()) { setSecret(""); setResendKey(""); setTest(null); toast({ tone: "success", title: "Email settings saved" }); reload(); } }}>Save</Button>
          </div>
        )}
      </div>
    </Card>
  );
}
