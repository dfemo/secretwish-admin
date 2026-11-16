"use client";

import { useEffect, useState } from "react";
import { api, ApiError, useMutation } from "@/shared/lib/api";
import { Badge, Button, Card, CardHeader, Field, Input, Textarea } from "@/shared/ui/primitives";
import { useToast } from "@/shared/ui/overlay";

/** What the contact page shows; null where nothing is set, so the website uses its own wording. */
export type ContactDetails = { email: string | null; deliveryAreas: string | null; supportHours: string | null };

/** The wording the website shows for any field left empty. */
const fallback = {
  email: "hello@secretwish.example",
  deliveryAreas: "Lagos, Abuja, Port Harcourt, Ibadan, Enugu and Kano — more cities soon.",
  supportHours: "Monday to Saturday, 8am – 8pm WAT. Urgent delivery issues are prioritised.",
};

/** The email, delivery areas and support hours on the website's contact page. Changes show straight away. */
export function ContactDetailsSettings({ contact, canEdit, onSaved }: { contact: ContactDetails; canEdit: boolean; onSaved: () => void }) {
  const toast = useToast();
  const initial = { email: contact.email ?? "", deliveryAreas: contact.deliveryAreas ?? "", supportHours: contact.supportHours ?? "" };
  const [form, setForm] = useState(initial);
  useEffect(() => setForm({ email: contact.email ?? "", deliveryAreas: contact.deliveryAreas ?? "", supportHours: contact.supportHours ?? "" }), [contact]);
  const save = useMutation(() => api<ContactDetails>("/admin/settings/contact", { method: "PUT", body: form }));
  const err = (k: string) => (save.error instanceof ApiError ? save.error.errors?.[k]?.[0] : undefined);
  const changed = form.email.trim() !== initial.email || form.deliveryAreas.trim() !== initial.deliveryAreas || form.supportHours.trim() !== initial.supportHours;
  const custom = !!(contact.email || contact.deliveryAreas || contact.supportHours);

  return (
    <Card className="mt-6">
      <CardHeader
        title="Contact details"
        description="Shown on the website's Contact page. Leave a field empty to use the default wording shown in grey."
        action={custom ? <Badge tone="plum">Custom</Badge> : <Badge tone="neutral">Default</Badge>}
      />
      <fieldset disabled={!canEdit} className="grid gap-4 p-5 lg:grid-cols-3">
        <Field label="Email" error={err("email")} hint="Where people write to you.">
          {(id, d) => <Input id={id} aria-describedby={d} type="email" inputMode="email" placeholder={fallback.email} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}
        </Field>
        <Field label="Where we deliver" error={err("deliveryAreas")}>
          {(id, d) => <Textarea id={id} aria-describedby={d} maxLength={300} placeholder={fallback.deliveryAreas} value={form.deliveryAreas} onChange={(e) => setForm({ ...form, deliveryAreas: e.target.value })} />}
        </Field>
        <Field label="Support hours" error={err("supportHours")}>
          {(id, d) => <Textarea id={id} aria-describedby={d} maxLength={300} placeholder={fallback.supportHours} value={form.supportHours} onChange={(e) => setForm({ ...form, supportHours: e.target.value })} />}
        </Field>
      </fieldset>
      {canEdit && (
        <div className="flex items-center justify-end gap-2 border-t border-ink-100 px-5 py-3">
          {save.error && !save.error.errors && <p className="text-xs text-danger-700">{save.error.message}</p>}
          <Button loading={save.pending} disabled={!changed} onClick={async () => { if (await save.run()) { toast({ tone: "success", title: "Contact details saved", body: "The Contact page shows them now." }); onSaved(); } }}>
            Save contact details
          </Button>
        </div>
      )}
    </Card>
  );
}
