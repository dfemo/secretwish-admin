"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Eye, EyeOff, Plus, Save, Trash2 } from "lucide-react";
import { api, useApi, useMutation } from "@/shared/lib/api";
import { useSession } from "@/shared/lib/session";
import { Badge, Button, Card, CardHeader, cx, ErrorState, Field, Input, Notice, PageHeader, PageSkeleton, Switch, Tabs } from "@/shared/ui/primitives";
import { useToast } from "@/shared/ui/overlay";
import { BillingToggle, PlanButton, PricingCards, yearlySaving, type Billing, type PlanCatalog, type PricingPlan } from "@/shared/ui/pricing";

type Audience = "customer" | "vendor";
type AdminCatalog = PlanCatalog & { canEdit: boolean };
/** A plan being edited: new plans have no id yet. */
type DraftPlan = Omit<PricingPlan, "id"> & { id: string | null; ref: string };
type DraftFeature = { ref: string; text: string };

const audiences: { value: Audience; label: string }[] = [
  { value: "customer", label: "Senders & wishlist owners" },
  { value: "vendor", label: "Vendors" },
];

let next = 0;
const tempRef = () => `new-${Date.now()}-${next++}`;

/** Admins set the plans on every pricing page: prices (USD, monthly and yearly), the card text, which plan is featured, and the
 * feature checklist with what each plan includes. Saved through the PlansController, all at once, and audit-logged. */
export default function PricingAdminPage() {
  const [audience, setAudience] = useState<Audience>("customer");
  const { data, error, loading, reload } = useApi<AdminCatalog>(`/plans/admin/${audience}`);
  const [plans, setPlans] = useState<DraftPlan[]>([]);
  const [features, setFeatures] = useState<DraftFeature[]>([]);
  const [billing, setBilling] = useState<Billing>("Yearly");
  const [dirty, setDirty] = useState(false);
  const toast = useToast();
  const { fmtIn } = useSession();
  const save = useMutation(() =>
    api<AdminCatalog>(`/plans/admin/${audience}`, {
      method: "PUT",
      body: {
        features: features.map((f) => ({ ref: f.ref, text: f.text })),
        plans: plans.map((p) => ({
          id: p.id, name: p.name, description: p.description, monthlyPriceUsd: p.monthlyPriceUsd, yearlyPriceUsd: p.yearlyPriceUsd,
          badge: p.badge || null, highlighted: p.highlighted, active: p.active, features: p.features,
        })),
      },
    }),
  );

  useEffect(() => {
    if (!data) return;
    setPlans(data.plans.map((p) => ({ ...p, ref: p.id })));
    setFeatures(data.features.map((f) => ({ ref: f.id, text: f.text })));
    setDirty(false);
  }, [data]);

  const preview = useMemo(
    () => ({
      plans: plans.filter((p) => p.active).map((p) => ({ ...p, id: p.ref })),
      features: features.filter((f) => f.text.trim()).map((f) => ({ id: f.ref, text: f.text })),
    }),
    [plans, features],
  );

  if (loading && !data) return error ? <ErrorState error={error} onRetry={reload} /> : <PageSkeleton />;
  if (!data) return <ErrorState error={error} onRetry={reload} />;
  const editable = data.canEdit;

  const edit = (ref: string, patch: Partial<DraftPlan>) => { setPlans((ps) => ps.map((p) => (p.ref === ref ? { ...p, ...patch } : p))); setDirty(true); };
  const move = <T,>(list: T[], i: number, by: number) => { const copy = [...list]; const [x] = copy.splice(i, 1); copy.splice(i + by, 0, x); return copy; };
  const toggleFeature = (plan: DraftPlan, ref: string) =>
    edit(plan.ref, { features: plan.features.includes(ref) ? plan.features.filter((f) => f !== ref) : [...plan.features, ref] });
  const problems = plans.flatMap((p) => {
    const name = p.name.trim() || "A plan";
    if (!p.name.trim()) return ["Every plan needs a name."];
    if (!p.isFree && (!(p.monthlyPriceUsd > 0) || !(p.yearlyPriceUsd > 0))) return [`${name}: set both a monthly and a yearly price.`];
    return [];
  }).concat(features.some((f) => !f.text.trim()) ? ["Every feature needs a description (or remove it)."] : [])
    .concat(plans.some((p) => p.active) ? [] : ["Keep at least one plan visible."]);

  return (
    <>
      <PageHeader
        title="Pricing & Plans"
        description="The plans on the website, the Sender app and the vendor portal. Prices are in US dollars and shown to people in their own currency. Paid plans are paid with the default payment engine (the first one switched on under Settings → Payment engines that takes the payer's currency)."
        actions={editable && (
          <Button icon={Save} disabled={!dirty || problems.length > 0} loading={save.pending}
            onClick={async () => { if (await save.run()) { toast({ tone: "success", title: "Pricing saved", body: "Every pricing page now shows these plans." }); reload(); } }}>
            Save pricing
          </Button>
        )}
      />
      <Tabs className="mb-6" tabs={audiences} value={audience} onChange={(a) => { if (!dirty || window.confirm("Discard your unsaved pricing changes?")) setAudience(a); }} />
      {!editable && <Notice className="mb-6">You can view pricing. Your team role doesn&apos;t include changing settings.</Notice>}
      {save.error && <Notice tone="danger" className="mb-6">{save.error.message}</Notice>}
      {problems.length > 0 && dirty && <Notice tone="warning" className="mb-6">{problems[0]}</Notice>}

      <fieldset disabled={!editable} className="space-y-6">
        <Card>
          <CardHeader
            title="Plans"
            description="Left to right as they appear. The free plan stays at $0 and can't be hidden; plans people are on can be hidden but not deleted."
            action={editable && plans.length < 6 && (
              <Button size="sm" variant="secondary" icon={Plus} onClick={() => {
                setPlans((ps) => [...ps, { id: null, ref: tempRef(), key: "", name: "New plan", description: "", monthlyPriceUsd: 10, yearlyPriceUsd: 96, badge: null, highlighted: false, active: true, isFree: false, features: [], accounts: 0 }]);
                setDirty(true);
              }}>Add plan</Button>
            )}
          />
          <div className="grid gap-4 p-5 md:grid-cols-2 2xl:grid-cols-3">
            {plans.map((p, i) => {
              const saving = yearlySaving(p);
              return (
                <div key={p.ref} className={cx("rounded-2xl border p-4", p.active ? "border-ink-200 bg-white" : "border-dashed border-ink-300 bg-ink-50")}>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink-900">{p.name || "Untitled"}</span>
                    {p.isFree && <Badge tone="success">Free plan</Badge>}
                    {!p.active && <Badge>Hidden</Badge>}
                    {p.highlighted && <Badge tone="plum">Featured</Badge>}
                    <span className="ml-auto text-xs text-ink-500">{p.id ? `${p.accounts ?? 0} on this plan` : "New"}</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Name">{(id) => <Input id={id} value={p.name} maxLength={60} onChange={(e) => edit(p.ref, { name: e.target.value })} />}</Field>
                    <Field label="Corner label" hint="e.g. Popular. Optional.">{(id, d) => <Input id={id} aria-describedby={d} value={p.badge ?? ""} maxLength={24} onChange={(e) => edit(p.ref, { badge: e.target.value })} />}</Field>
                    <Field label="Monthly price (USD)" hint="Per month, billed monthly.">
                      {(id, d) => <Input id={id} aria-describedby={d} type="number" min={0} step="0.01" disabled={p.isFree} value={p.monthlyPriceUsd} onChange={(e) => edit(p.ref, { monthlyPriceUsd: Number(e.target.value) })} />}
                    </Field>
                    <Field label="Yearly price (USD)" hint={p.isFree ? "Always free." : saving > 0 ? `Saves ${saving}% vs paying monthly.` : "For the whole year."}>
                      {(id, d) => <Input id={id} aria-describedby={d} type="number" min={0} step="0.01" disabled={p.isFree} value={p.yearlyPriceUsd} onChange={(e) => edit(p.ref, { yearlyPriceUsd: Number(e.target.value) })} />}
                    </Field>
                  </div>
                  <Field label="Description" className="mt-3">
                    {(id) => <textarea id={id} rows={2} maxLength={300} value={p.description} onChange={(e) => edit(p.ref, { description: e.target.value })}
                      className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900" />}
                  </Field>
                  <div className="mt-3 space-y-2">
                    <Switch label="Featured card" description="Shown dark, with the saving in its corner." checked={p.highlighted} onChange={(v) => edit(p.ref, { highlighted: v })} />
                  </div>
                  {p.id && !p.isFree && <p className="mt-2 text-[11px] text-ink-400">Saved on accounts as “{p.key} Monthly” / “{p.key} Yearly”.</p>}
                  {editable && (
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-ink-100 pt-3">
                      <Button size="sm" variant="ghost" icon={ArrowLeft} aria-label={`Move ${p.name} left`} disabled={i === 0} onClick={() => { setPlans(move(plans, i, -1)); setDirty(true); }} />
                      <Button size="sm" variant="ghost" icon={ArrowRight} aria-label={`Move ${p.name} right`} disabled={i === plans.length - 1} onClick={() => { setPlans(move(plans, i, 1)); setDirty(true); }} />
                      <Button size="sm" variant="ghost" icon={p.active ? EyeOff : Eye} disabled={p.isFree} onClick={() => edit(p.ref, { active: !p.active })}>{p.active ? "Hide" : "Show"}</Button>
                      <Button size="sm" variant="ghost" icon={Trash2} className="ml-auto text-danger-700" disabled={p.isFree || (p.accounts ?? 0) > 0}
                        title={(p.accounts ?? 0) > 0 ? "People are on this plan: hide it instead." : undefined}
                        onClick={() => { setPlans(plans.filter((x) => x.ref !== p.ref)); setDirty(true); }}>Delete</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Features"
            description="The checklist on every card, top to bottom. Tick what each plan includes; the rest show crossed out."
            action={editable && features.length < 25 && (
              <Button size="sm" variant="secondary" icon={Plus} onClick={() => { setFeatures([...features, { ref: tempRef(), text: "" }]); setDirty(true); }}>Add feature</Button>
            )}
          />
          <div className="overflow-x-auto p-5 pt-2">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-500">
                  <th className="py-2 pr-3 font-medium">Feature</th>
                  {plans.map((p) => <th key={p.ref} className="w-24 px-2 py-2 text-center font-medium">{p.name || "Untitled"}</th>)}
                  {editable && <th className="w-28" aria-label="Actions" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {features.map((f, i) => (
                  <tr key={f.ref}>
                    <td className="py-2 pr-3">
                      <label className="sr-only" htmlFor={`feature-${f.ref}`}>Feature {i + 1}</label>
                      <Input id={`feature-${f.ref}`} value={f.text} maxLength={120} placeholder="e.g. Priority support"
                        onChange={(e) => { setFeatures(features.map((x) => (x.ref === f.ref ? { ...x, text: e.target.value } : x))); setDirty(true); }} />
                    </td>
                    {plans.map((p) => (
                      <td key={p.ref} className="px-2 py-2 text-center">
                        <input type="checkbox" className="size-4 accent-plum-700" aria-label={`${p.name} includes ${f.text || "this feature"}`}
                          checked={p.features.includes(f.ref)} onChange={() => toggleFeature(p, f.ref)} />
                      </td>
                    ))}
                    {editable && (
                      <td className="py-2 text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" icon={ArrowUp} aria-label="Move up" disabled={i === 0} onClick={() => { setFeatures(move(features, i, -1)); setDirty(true); }} />
                        <Button size="sm" variant="ghost" icon={ArrowDown} aria-label="Move down" disabled={i === features.length - 1} onClick={() => { setFeatures(move(features, i, 1)); setDirty(true); }} />
                        <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Remove ${f.text || "feature"}`} className="text-danger-700"
                          onClick={() => { setFeatures(features.filter((x) => x.ref !== f.ref)); setPlans(plans.map((p) => ({ ...p, features: p.features.filter((r) => r !== f.ref) }))); setDirty(true); }} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {features.length === 0 && <p className="py-6 text-center text-sm text-ink-500">No features yet. Add the first one.</p>}
          </div>
        </Card>
      </fieldset>

      <section aria-labelledby="preview" className="mt-10 rounded-[32px] bg-[linear-gradient(135deg,#f3eef7_0%,#fbf6e8_100%)] p-5 md:p-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h2 id="preview" className="font-display text-3xl font-semibold text-plum-900">Preview</h2>
          <BillingToggle value={billing} onChange={setBilling} />
        </div>
        <PricingCards catalog={preview} billing={billing} format={(usd) => fmtIn(usd, "USD")} currencyNote="(USD)"
          action={(p) => <PlanButton plan={p} disabled>{p.isFree ? "Get started" : `Choose ${p.name}`}</PlanButton>} />
        {dirty && <p className="mt-6 text-center text-xs text-ink-500">Previewing unsaved changes.</p>}
      </section>
    </>
  );
}
