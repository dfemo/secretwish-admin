"use client";

import { useState } from "react";
import { Check, KeyRound, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { api, useApi, useMutation } from "@/shared/lib/api";
import { dateTime } from "@/shared/lib/format";
import { Badge, Button, Card, ErrorState, Field, Input, Notice, PageHeader, PageSkeleton, Select, Textarea } from "@/shared/ui/primitives";
import { ConfirmDialog, Modal, useToast } from "@/shared/ui/overlay";

type Role = { id: string; name: string; description: string; dataAccess: string; permissions: string[]; isSystem: boolean; members: number; updatedAt: string; updatedBy: string };
type Permission = { key: string; group: string; label: string; description: string };
type Level = { value: string; label: string; description: string };
type Data = { canEdit: boolean; superAdmins: number; roles: Role[]; permissions: Permission[]; dataAccessLevels: Level[] };
type Draft = { id?: string; isSystem?: boolean; name: string; description: string; dataAccess: string; permissions: string[] };

export default function RolesPage() {
  const { data, error, loading, reload } = useApi<Data>("/admin/roles");
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const save = useMutation((d: Draft) =>
    api(d.id ? `/admin/roles/${d.id}` : "/admin/roles", { method: d.id ? "PUT" : "POST", body: { name: d.name, description: d.description, dataAccess: d.dataAccess, permissions: d.permissions } }),
  );
  const remove = useMutation((id: string) => api(`/admin/roles/${id}`, { method: "DELETE" }));

  if (loading && !data) return <PageSkeleton />;
  if (!data) return <ErrorState error={error} onRetry={reload} />;
  const groups = [...new Set(data.permissions.map((p) => p.group))];
  const levelLabel = (v: string) => data.dataAccessLevels.find((l) => l.value === v)?.label ?? v;

  const toggle = (key: string) => setDraft((d) => d && { ...d, permissions: d.permissions.includes(key) ? d.permissions.filter((k) => k !== key) : [...d.permissions, key] });
  const toggleGroup = (group: string, on: boolean) =>
    setDraft((d) => {
      if (!d) return d;
      const keys = data.permissions.filter((p) => p.group === group).map((p) => p.key);
      return { ...d, permissions: on ? [...new Set([...d.permissions, ...keys])] : d.permissions.filter((k) => !keys.includes(k)) };
    });

  async function submit() {
    if (!draft) return;
    if (await save.run(draft)) {
      toast({ tone: "success", title: draft.id ? `${draft.name} updated` : `${draft.name} created`, body: draft.id ? "Members get the change on their next action." : "Give it to people from the Team page." });
      setDraft(null);
      reload();
    }
  }

  return (
    <>
      <PageHeader
        title="Roles & Privileges"
        description="A role is a set of privileges: which admin areas someone sees and what they can do there, plus how much customer data they see. Super admins always have every privilege."
        actions={data.canEdit && (
          <Button icon={Plus} onClick={() => { setDraft({ name: "", description: "", dataAccess: "Support", permissions: ["overview.view"] }); }}>
            New role
          </Button>
        )}
      />
      {!data.canEdit && <Notice className="mb-6">Only super admins can create or change roles.</Notice>}
      <Notice tone="info" className="mb-6" icon={KeyRound} title={`${data.superAdmins} super admin${data.superAdmins === 1 ? "" : "s"}`}>
        Super admins can do everything, including adding team members and defining these roles. The default super admin is set on the server and can&apos;t be removed.
      </Notice>

      <ul className="grid gap-5 xl:grid-cols-2">
        {data.roles.map((r) => (
          <li key={r.id}>
            <Card className="flex h-full flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-plum-900">
                    {r.name} {r.isSystem && <Badge tone="neutral" icon={Lock}>Built-in</Badge>}
                  </h2>
                  {r.description && <p className="mt-0.5 text-sm text-ink-500">{r.description}</p>}
                </div>
                <Badge tone="plum">{r.members} member{r.members === 1 ? "" : "s"}</Badge>
              </div>
              <p className="mt-3 text-xs text-ink-500">
                Customer data: <span className="font-semibold text-ink-700">{levelLabel(r.dataAccess)}</span> · {r.permissions.length} of {data.permissions.length} privileges
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {groups.map((g) => {
                  const keys = data.permissions.filter((p) => p.group === g);
                  const n = keys.filter((p) => r.permissions.includes(p.key)).length;
                  return (
                    <span key={g} className={n === 0 ? "rounded-full bg-ink-50 px-2.5 py-1 text-xs text-ink-400 line-through" : "rounded-full bg-plum-50 px-2.5 py-1 text-xs font-semibold text-plum-800"}>
                      {g} {n > 0 && n < keys.length && <span className="font-normal">({n}/{keys.length})</span>}
                    </span>
                  );
                })}
              </div>
              <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                <p className="text-[11px] text-ink-400">Updated {dateTime(r.updatedAt)}{r.updatedBy && ` by ${r.updatedBy}`}</p>
                <div className="flex gap-1">
                  {data.canEdit && !r.isSystem && (
                    <Button size="sm" variant="ghost" icon={Trash2} disabled={r.members > 0} onClick={() => setDeleting(r)} aria-label={`Delete ${r.name}`}>
                      Delete
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" icon={data.canEdit ? Pencil : undefined} onClick={() => setDraft({ id: r.id, isSystem: r.isSystem, name: r.name, description: r.description, dataAccess: r.dataAccess, permissions: r.permissions })}>
                    {data.canEdit ? "Edit" : "View"}
                  </Button>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        size="xl"
        title={draft?.id ? (data.canEdit ? `Edit ${draft.name || "role"}` : draft.name) : "New role"}
        description="Choose what members of this role can see and do. Changes apply on each member's next action and are audit-logged."
        footer={
          data.canEdit ? (
            <>
              <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
              <Button loading={save.pending} onClick={submit}>{draft?.id ? "Save role" : "Create role"}</Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setDraft(null)}>Close</Button>
          )
        }
      >
        {draft && (
          <fieldset disabled={!data.canEdit} className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Role name" required>
                {(id) => <Input id={id} maxLength={60} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Vendor onboarding" />}
              </Field>
              <Field label="Customer data access" hint={draft.isSystem ? "Built-in roles keep their level." : data.dataAccessLevels.find((l) => l.value === draft.dataAccess)?.description}>
                {(id, d) => (
                  <Select id={id} aria-describedby={d} value={draft.dataAccess} disabled={draft.isSystem} onChange={(e) => setDraft({ ...draft, dataAccess: e.target.value })}>
                    {data.dataAccessLevels.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="Description" className="sm:col-span-2">
                {(id) => <Textarea id={id} maxLength={300} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="min-h-[56px]" />}
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {groups.map((g) => {
                const perms = data.permissions.filter((p) => p.group === g);
                const all = perms.every((p) => draft.permissions.includes(p.key));
                return (
                  <section key={g} className="rounded-2xl border border-ink-200 p-3" aria-labelledby={`g-${g}`}>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 id={`g-${g}`} className="text-[13px] font-semibold text-plum-900">{g}</h3>
                      {data.canEdit && (
                        <button type="button" className="text-xs font-semibold text-plum-700 hover:underline" onClick={() => toggleGroup(g, !all)}>
                          {all ? "Clear" : "Select all"}
                        </button>
                      )}
                    </div>
                    <ul className="space-y-1.5">
                      {perms.map((p) => (
                        <li key={p.key}>
                          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg p-1.5 hover:bg-ink-50">
                            <input type="checkbox" className="mt-0.5 size-4 accent-plum-700" checked={draft.permissions.includes(p.key)} onChange={() => toggle(p.key)} />
                            <span>
                              <span className="block text-[13px] font-semibold text-ink-900">{p.label}</span>
                              <span className="block text-xs text-ink-500">{p.description}</span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
            <p className="flex items-center gap-1.5 text-xs text-ink-500">
              <Check className="size-3.5 text-success-700" aria-hidden /> {draft.permissions.length} of {data.permissions.length} privileges selected
            </p>
            {save.error && <Notice tone="danger">{save.error.message}</Notice>}
          </fieldset>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="Nobody has this role, so no one loses access. This can't be undone."
        confirmLabel="Delete role"
        tone="danger"
        pending={remove.pending}
        error={remove.error?.message}
        onConfirm={async () => {
          if (deleting && (await remove.run(deleting.id))) {
            toast({ tone: "success", title: `${deleting.name} deleted` });
            setDeleting(null);
            reload();
          }
        }}
      />
    </>
  );
}
