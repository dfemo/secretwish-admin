"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Globe } from "lucide-react";
import { api, ApiError, useMutation } from "@/shared/lib/api";
import { Badge, Button, Card, CardHeader, Field, Input } from "@/shared/ui/primitives";
import { useToast } from "@/shared/ui/overlay";

/** The home link in use, what it falls back to, and whether this deployment overrides it. */
export type WebsiteLink = { url: string; configured: string | null; overridden: boolean };

/**
 * Where "Back to SecretWish home" goes on this deployment: the sign-in pages and every app's sign-in screen. Stored in this
 * deployment's database, so dev can point at the dev website and production at the live one, and changes need no redeploy.
 */
export function WebsiteLinkSettings({ website, canEdit, onSaved }: { website: WebsiteLink; canEdit: boolean; onSaved: () => void }) {
  const toast = useToast();
  const [value, setValue] = useState(website.overridden ? website.url : "");
  useEffect(() => setValue(website.overridden ? website.url : ""), [website]);
  const save = useMutation((url: string) => api<WebsiteLink>("/admin/settings/website-url", { method: "PUT", body: { url } }));
  const fieldError = save.error instanceof ApiError ? (save.error.errors?.url?.[0] ?? save.error.message) : null;

  async function submit(url: string) {
    const r = await save.run(url);
    if (r) {
      toast({ tone: "success", title: "Home link updated", body: r.overridden ? `It now goes to ${r.url}.` : "It's back to the default for this deployment." });
      onSaved();
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader
        title="Website address"
        description="Where “Back to SecretWish home” goes from the sign-in pages and each app's sign-in screen. Set it per deployment, e.g. your dev website on dev. Takes effect straight away."
        action={website.overridden ? <Badge tone="plum">Custom</Badge> : <Badge tone="neutral">Default</Badge>}
      />
      <div className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <fieldset disabled={!canEdit} className="min-w-0">
          <Field
            label="Website address"
            error={fieldError}
            hint={<>Leave empty to use the default{website.configured ? <> (<span className="break-all">{website.configured}</span>, from the Site__WebsiteUrl setting)</> : " (the sign-in page itself, since Site__WebsiteUrl isn't set)"}.</>}
          >
            {(id, d) => (
              <Input id={id} aria-describedby={d} type="url" inputMode="url" placeholder={website.configured ?? "https://secretwish.com"} value={value}
                onChange={(e) => { setValue(e.target.value); save.setError(null); }} />
            )}
          </Field>
        </fieldset>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {website.overridden && <Button variant="ghost" disabled={save.pending} onClick={() => submit("")}>Use default</Button>}
            <Button loading={save.pending} disabled={value.trim() === (website.overridden ? website.url : "")} onClick={() => submit(value)}>Save address</Button>
          </div>
        )}
      </div>
      <p className="flex flex-wrap items-center gap-1.5 border-t border-ink-100 px-5 py-3 text-xs text-ink-500">
        <Globe className="size-3.5" aria-hidden /> Links go to
        <a href={website.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold break-all text-plum-700 hover:underline">
          {website.url} <ExternalLink className="size-3" aria-hidden />
        </a>
      </p>
    </Card>
  );
}
