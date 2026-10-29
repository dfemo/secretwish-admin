"use client";

import { useEffect, useState } from "react";
import { api, useMutation } from "../lib/api";
import { Button, Field, Input, Notice, Select, Textarea } from "./primitives";
import { Modal, useToast } from "./overlay";

export type OrderAction = { key: string; label: string };

type Spec = { fields: ("note" | "tracking" | "evidence")[]; noteLabel?: string; tone?: "primary" | "danger" | "gold"; help?: string; consequential?: boolean };

// What each workflow action needs from the person performing it. The API enforces the same rules.
const specs: Record<string, Spec> = {
  "confirm-payment": { fields: [], help: "Simulates a successful payment webhook from the provider sandbox. No real money moves." },
  "send-to-vendor": { fields: [] },
  accept: { fields: [], help: "You'll have the order ready for dispatch within your stated fulfilment time." },
  reject: { fields: ["note"], noteLabel: "Why can't you fulfil this order?", tone: "danger", consequential: true, help: "The sender will be refunded or offered an alternative by SecretWish operations." },
  dispatch: { fields: ["tracking"], help: "The recipient gets a discreet 'on its way' notice and a single-use secret code." },
  redispatch: { fields: ["tracking"] },
  "report-issue": { fields: ["note"], noteLabel: "What went wrong?", tone: "danger" },
  "confirm-delivery": { fields: ["evidence"], help: "Delivery must be backed by evidence (e.g. courier proof-of-delivery). It does not by itself make the order payable." },
  "request-refund": { fields: ["note"], noteLabel: "Reason for the refund", tone: "danger", consequential: true },
  cancel: { fields: ["note"], noteLabel: "Reason for cancelling", tone: "danger", consequential: true, help: "If payment was already taken, a refund case is opened instead." },
  "fraud-hold": { fields: ["note"], noteLabel: "Reason for the hold", tone: "danger", consequential: true, help: "Blocks payout eligibility until released." },
  "release-hold": { fields: ["note"], noteLabel: "Why is it safe to release?" },
};

const couriers = ["GIG Logistics", "Kwik Delivery", "DHL Express NG", "Vendor rider"];

export function OrderActionDialog({ action, basePath, orderId, onClose }: { action: OrderAction | null; basePath: string; orderId: string; onClose: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [tracking, setTracking] = useState("");
  const [courier, setCourier] = useState(couriers[0]);
  const [evidence, setEvidence] = useState("");
  const [touched, setTouched] = useState(false);
  const run = useMutation((key: string, body: object) => api(`${basePath}/orders/${orderId}/actions/${key}`, { method: "POST", body }));

  useEffect(() => {
    setNote("");
    setTracking("");
    setEvidence("");
    setTouched(false);
    run.setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action?.key]);

  if (!action) return null;
  const spec = specs[action.key] ?? { fields: [] };
  const errors = {
    note: spec.fields.includes("note") && note.trim().length < 3 ? "Please add a short explanation." : null,
    tracking: spec.fields.includes("tracking") && tracking.trim().length < 4 ? "Enter the courier tracking reference." : null,
    evidence: spec.fields.includes("evidence") && evidence.trim().length < 6 ? "Describe the delivery evidence (e.g. POD reference)." : null,
  };
  const invalid = Object.values(errors).some(Boolean);

  const submit = async () => {
    setTouched(true);
    if (invalid) return;
    const ok = await run.run(action.key, { note: note || null, trackingReference: tracking || null, courier, evidence: evidence || null });
    if (ok !== undefined) {
      toast({ tone: "success", title: `${action.label} — done`, body: "All dashboards now show the updated status." });
      onClose();
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={action.label}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={spec.tone ?? "primary"} loading={run.pending} onClick={submit}>
            {action.label}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {spec.consequential && <Notice tone="warning">This affects the customer and vendor and is recorded in the audit log.</Notice>}
        {spec.help && <p className="text-sm text-ink-700">{spec.help}</p>}
        {spec.fields.includes("tracking") && (
          <>
            <Field label="Courier">
              {(id) => (
                <Select id={id} value={courier} onChange={(e) => setCourier(e.target.value)}>
                  {couriers.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Tracking reference" required error={touched ? errors.tracking : null}>
              {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={touched && !!errors.tracking} value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="e.g. GIG-482913" />}
            </Field>
          </>
        )}
        {spec.fields.includes("evidence") && (
          <Field label="Delivery evidence" required error={touched ? errors.evidence : null} hint="Courier POD reference, signature or photo ID.">
            {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={touched && !!errors.evidence} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Courier POD-55120 (photo + signature)" />}
          </Field>
        )}
        {spec.fields.includes("note") && (
          <Field label={spec.noteLabel ?? "Note"} required error={touched ? errors.note : null}>
            {(id, d) => <Textarea id={id} aria-describedby={d} aria-invalid={touched && !!errors.note} value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
        )}
        {run.error && <Notice tone="danger">{run.error.message}</Notice>}
      </div>
    </Modal>
  );
}
