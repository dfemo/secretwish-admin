"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Copy, Globe2, KeyRound, Radio, RefreshCw, ShieldAlert, XCircle } from "lucide-react";
import { dateTime } from "@/shared/lib/format";
import { api, ApiError, useApi, useMutation } from "@/shared/lib/api";
import { useAccess } from "@/lib/access";
import { Badge, Button, Card, CardHeader, cx, Field, Input, Notice, Select, Switch } from "@/shared/ui/primitives";
import { useToast } from "@/shared/ui/overlay";

type KeyName = "testSecretKey" | "testPublicKey" | "testWebhookSecret" | "liveSecretKey" | "livePublicKey" | "liveWebhookSecret";
type Provider = {
  provider: "Simulated" | "Paystack" | "Flutterwave" | "Stripe";
  enabled: boolean; mode: "Test" | "Live"; effectiveMode: "Test" | "Live"; currencies: string[]; nigeriaPayouts: boolean; usable: boolean;
  updatedAt: string | null; updatedBy: string | null; webhookUrl: string | null;
  /** Never the keys themselves: "••••4f2a" when saved, null when not. */
  keys: Record<KeyName, string | null> | null;
};
type Data = { masterKeyReady: boolean; allowLive: boolean; providers: Provider[] };

const help: Record<Provider["provider"], { dashboard: string; webhookLabel?: string; webhookHint?: string; payouts: boolean }> = {
  Simulated: { dashboard: "", payouts: false },
  Paystack: { dashboard: "dashboard.paystack.com → Settings → API Keys & Webhooks", payouts: true },
  Flutterwave: { dashboard: "app.flutterwave.com → Settings → API keys and Webhooks", webhookLabel: "Secret hash", webhookHint: "The secret hash you set under Webhooks.", payouts: true },
  Stripe: { dashboard: "dashboard.stripe.com → Developers → API keys and Webhooks", webhookLabel: "Webhook signing secret", webhookHint: "whsec_… from the webhook endpoint you add.", payouts: false },
};

/**
 * Super admins only: the payment engines senders can pay with, their keys and currencies. Keys are encrypted with the deployment's
 * Payments__MasterKey and never shown again; leave a key field empty to keep the saved one.
 */
export function PaymentEngineSettings() {
  const { isSuperAdmin } = useAccess();
  const { data, error, reload } = useApi<Data>(isSuperAdmin ? "/payments/admin/providers" : null);
  if (!isSuperAdmin) return null;
  return (
    <Card className="mt-6">
      <CardHeader
        title="Payment engines"
        description="How senders pay. Senders choose between the engines switched on here. Only super admins see this; keys are encrypted and never shown again."
        action={<Badge tone="plum" icon={KeyRound}>Super admins only</Badge>}
      />
      <div className="space-y-4 p-5 pt-0">
        {error && <Notice tone="danger">{error.message}</Notice>}
        {data && !data.masterKeyReady && (
          <Notice tone="warning" icon={ShieldAlert} title="Set Payments__MasterKey first">
            Keys can&apos;t be saved until this deployment has a Payments__MasterKey variable (32 random bytes, base64). In Railway, add it to the API service&apos;s
            variables and redeploy.
          </Notice>
        )}
        {data && !data.allowLive && <p className="text-xs text-ink-500">Live mode (real money) is switched off on this deployment, so every engine uses its test keys.</p>}
        <OutboundIp />
        <RecentWebhooks />
        {data?.providers.map((p) => <ProviderCard key={p.provider} p={p} data={data} onSaved={reload} />)}
      </div>
    </Card>
  );
}

type Hook = { id: string; provider: string; at: string; outcome: string; type: string | null; reference: string | null; status: string | null; detail: string | null };
const hookTone: Record<string, "success" | "warning" | "danger" | "neutral"> = { Applied: "success", Duplicate: "neutral", Ignored: "neutral", NoMatch: "warning", BadSignature: "danger", NoKeys: "danger", Unreadable: "danger" };
const hookLabel: Record<string, string> = { Applied: "Applied", Duplicate: "Repeat (ignored)", Ignored: "Not used", NoMatch: "No matching transfer", BadSignature: "Refused: secret didn't match", NoKeys: "Refused: no keys", Unreadable: "Unreadable" };

/** The latest webhooks from the engines and what happened to each, to see whether they arrive and why one was refused. */
function RecentWebhooks() {
  const { data, error, refreshing, reload } = useApi<Hook[]>("/payments/admin/webhooks");
  return (
    <div className="rounded-2xl border border-ink-100 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Radio className="size-4 text-plum-700" aria-hidden />
        <p className="font-semibold text-ink-900">Recent webhooks</p>
        <Button size="sm" variant="ghost" icon={RefreshCw} loading={refreshing} onClick={reload} className="ml-auto">Refresh</Button>
      </div>
      {error && <p className="mt-2 text-danger-700">{error.message}</p>}
      {data && data.length === 0 && (
        <p className="mt-2 text-ink-500">No webhooks have arrived in the last 30 days. Check that each engine&apos;s dashboard has the webhook URL below, and its secret hash saved here.</p>
      )}
      {data && data.length > 0 && (
        <ul className="mt-2 divide-y divide-ink-100">
          {data.slice(0, 15).map((h) => (
            <li key={h.id} className="py-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={hookTone[h.outcome] ?? "neutral"}>{hookLabel[h.outcome] ?? h.outcome}</Badge>
                <span className="font-medium text-ink-900">{h.provider}</span>
                {h.type && <code className="text-xs text-ink-500">{h.type}</code>}
                {h.status && <Badge tone="neutral">{h.status}</Badge>}
                <span className="ml-auto text-xs text-ink-500">{dateTime(h.at)}</span>
              </div>
              {(h.reference || h.detail) && <p className="mt-1 break-words text-xs text-ink-700">{[h.reference, h.detail].filter(Boolean).join(" · ")}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The IP address the API's requests to engines come from, for allow-lists such as Flutterwave's (needed for transfers). */
function OutboundIp() {
  const toast = useToast();
  const { data, error, refreshing, reload } = useApi<{ ipv4: string | null; ipv6: string | null; checkedAt: string }>("/payments/admin/outbound-ip");
  const ips = [data?.ipv4, data?.ipv6].filter((x): x is string => !!x);
  return (
    <div className="rounded-2xl border border-ink-100 bg-ink-50/60 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Globe2 className="size-4 text-plum-700" aria-hidden />
        <p className="font-semibold text-ink-900">Server&apos;s outgoing IP</p>
        <Button size="sm" variant="ghost" icon={RefreshCw} loading={refreshing} onClick={reload} className="ml-auto">Check again</Button>
      </div>
      {error && <p className="mt-2 text-danger-700">{error.message}</p>}
      {ips.map((ip) => (
        <div key={ip} className="mt-2 flex flex-wrap items-center gap-2">
          <code className="min-w-0 break-all rounded-lg bg-white px-2 py-1 text-ink-900 ring-1 ring-ink-100">{ip}</code>
          <Button size="sm" variant="ghost" icon={Copy} onClick={async () => { await navigator.clipboard.writeText(ip); toast({ tone: "success", title: "IP copied" }); }}>Copy</Button>
        </div>
      ))}
      <p className="mt-2 text-xs text-ink-500">
        Add this to the engine&apos;s IP allow-list (Flutterwave: Settings → Whitelisted IP addresses). Without a static outbound IP on the host it can change after a
        redeploy, so check again after each deploy.
      </p>
    </div>
  );
}

function ProviderCard({ p, data, onSaved }: { p: Provider; data: Data; onSaved: () => void }) {
  const toast = useToast();
  const [enabled, setEnabled] = useState(p.enabled);
  const [mode, setMode] = useState(p.mode);
  const [currencies, setCurrencies] = useState(p.currencies.join(", "));
  const [payouts, setPayouts] = useState(p.nigeriaPayouts);
  const [keys, setKeys] = useState<Partial<Record<KeyName, string>>>({});
  const [clear, setClear] = useState<KeyName[]>([]);
  const [check, setCheck] = useState<{ ok: boolean; message: string } | null>(null);
  useEffect(() => { setEnabled(p.enabled); setMode(p.mode); setCurrencies(p.currencies.join(", ")); setPayouts(p.nigeriaPayouts); setKeys({}); setClear([]); }, [p]);
  const save = useMutation(() =>
    api(`/payments/admin/providers/${p.provider}`, { method: "PUT", body: { enabled, mode, currencies, nigeriaPayouts: payouts, keys, clear } }));
  const test = useMutation(() => api<{ ok: boolean; message: string }>(`/payments/admin/providers/${p.provider}/check`, { method: "POST" }));
  const fieldError = (k: string) => (save.error instanceof ApiError ? save.error.errors?.[k]?.[0] : undefined);
  const h = help[p.provider];
  const simulated = p.provider === "Simulated";

  const keyField = (name: KeyName, label: string, hint?: string) => {
    const saved = p.keys?.[name];
    const removing = clear.includes(name);
    return (
      <Field label={label} error={fieldError(name)} hint={removing ? "Will be removed when you save." : saved ? `Saved (${saved}). Leave empty to keep it.` : hint}>
        {(id, d) => (
          <div className="flex gap-2">
            <Input id={id} aria-describedby={d} type="password" autoComplete="off" spellCheck={false} disabled={!data.masterKeyReady || removing}
              value={keys[name] ?? ""} placeholder={saved ? "••••••••" : "Paste the key"} onChange={(e) => setKeys({ ...keys, [name]: e.target.value })} />
            {saved && (
              <Button variant="ghost" size="sm" onClick={() => setClear(removing ? clear.filter((c) => c !== name) : [...clear, name])}>{removing ? "Keep" : "Remove"}</Button>
            )}
          </div>
        )}
      </Field>
    );
  };

  return (
    <section className={cx("rounded-2xl border p-4", p.usable ? "border-success-600/30 bg-success-50/40" : "border-ink-200 bg-white")} aria-labelledby={`pe-${p.provider}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={`pe-${p.provider}`} className="text-base font-semibold text-ink-900">{simulated ? "Simulated (no real money)" : p.provider}</h3>
        {p.usable ? <Badge tone="success">On · {p.effectiveMode === "Live" ? "live" : "test"}</Badge> : <Badge>Off</Badge>}
        {p.nigeriaPayouts && <Badge tone="gold">Pays Nigerian banks</Badge>}
        {p.updatedBy && <span className="ml-auto text-xs text-ink-400">Changed by {p.updatedBy}</span>}
      </div>
      {simulated ? (
        <p className="mt-1 text-sm text-ink-500">Shows &ldquo;Simulate successful payment&rdquo; at checkout. Handy for demos; switch it off once real engines are set up.</p>
      ) : (
        <p className="mt-1 text-xs text-ink-500">Keys are in {h.dashboard}.</p>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Switch label="Offer to senders" checked={enabled} onChange={setEnabled} />
        {!simulated && (
          <>
            <Field label="Mode">
              {(id) => (
                <Select id={id} value={mode} onChange={(e) => setMode(e.target.value as Provider["mode"])}>
                  <option value="Test">Test (sandbox money)</option>
                  <option value="Live" disabled={!data.allowLive}>Live (real money){data.allowLive ? "" : " · off on this deployment"}</option>
                </Select>
              )}
            </Field>
            <Field label="Currencies" error={fieldError("currencies")} hint="ISO codes senders can pay in, e.g. NGN, USD.">
              {(id, d) => <Input id={id} aria-describedby={d} value={currencies} onChange={(e) => setCurrencies(e.target.value.toUpperCase())} />}
            </Field>
          </>
        )}
      </div>

      {!simulated && (
        <>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {keyField("testSecretKey", "Test secret key", p.provider === "Flutterwave" ? "FLWSECK_TEST-…" : "sk_test_…")}
            {keyField("testPublicKey", "Test public key", "Optional.")}
            {h.webhookLabel ? keyField("testWebhookSecret", `Test ${h.webhookLabel.toLowerCase()}`, h.webhookHint) : <div />}
            {data.allowLive && (
              <>
                {keyField("liveSecretKey", "Live secret key", p.provider === "Flutterwave" ? "FLWSECK-…" : "sk_live_…")}
                {keyField("livePublicKey", "Live public key", "Optional.")}
                {h.webhookLabel ? keyField("liveWebhookSecret", `Live ${h.webhookLabel.toLowerCase()}`, h.webhookHint) : <div />}
              </>
            )}
          </div>
          {fieldError("keys") && <Notice tone="danger" className="mt-3">{fieldError("keys")}</Notice>}
          {h.payouts && (
            <div className="mt-4 max-w-xl">
              <Switch label="Use for payouts to Nigerian banks" description="Vendor payouts and recipients' cash gifts. Only one engine at a time." checked={payouts} onChange={setPayouts} />
            </div>
          )}
          {p.webhookUrl && (
            <div className="mt-4 rounded-xl bg-ink-50 p-3 text-xs">
              <p className="font-semibold text-ink-700">Webhook URL (paste into the {p.provider} dashboard)</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all text-ink-900">{p.webhookUrl}</code>
                <Button size="sm" variant="ghost" icon={Copy} onClick={async () => { await navigator.clipboard.writeText(p.webhookUrl!); toast({ tone: "success", title: "Webhook URL copied" }); }}>Copy</Button>
              </div>
            </div>
          )}
        </>
      )}

      {save.error && !save.error.errors && <Notice tone="danger" className="mt-3">{save.error.message}</Notice>}
      {check && <Notice className="mt-3" tone={check.ok ? "success" : "danger"} icon={check.ok ? CheckCircle2 : XCircle}>{check.message}</Notice>}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {!simulated && (
          <Button variant="secondary" loading={test.pending} disabled={!p.keys?.[p.effectiveMode === "Live" ? "liveSecretKey" : "testSecretKey"]}
            onClick={async () => { setCheck(null); const r = await test.run(); if (r) setCheck(r); }}>
            Check keys
          </Button>
        )}
        <Button loading={save.pending} onClick={async () => { setCheck(null); if (await save.run()) { toast({ tone: "success", title: `${p.provider} saved` }); onSaved(); } }}>
          Save {simulated ? "" : p.provider}
        </Button>
      </div>
    </section>
  );
}
