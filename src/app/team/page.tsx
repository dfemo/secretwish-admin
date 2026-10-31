"use client";

import Link from "next/link";
import { useState } from "react";
import { Crown, UserPlus } from "lucide-react";
import { api, useApi, useMutation } from "@/shared/lib/api";
import { DataTable, type Column } from "@/shared/ui/data";
import { Badge, Button, Card, CardHeader, ErrorState, Field, Input, Notice, PageHeader, PageSkeleton, Select } from "@/shared/ui/primitives";
import { ConfirmDialog, Modal, useToast } from "@/shared/ui/overlay";

type Member = {
  id: string; name: string; email: string | null; isSuperAdmin: boolean; isDefaultSuperAdmin: boolean; roleId: string | null; role: string;
  isVendor: boolean; isMe: boolean; createdAt: string; canEdit: boolean;
};
type Role = { id: string; name: string; description: string; dataAccess: string; assignable: boolean };
type Data = { canManage: boolean; isSuperAdmin: boolean; members: Member[]; roles: Role[] };

const blank = { name: "", email: "", roleId: "" };

export default function TeamPage() {
  const { data, error, loading, reload } = useApi<Data>("/admin/team");
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [superFor, setSuperFor] = useState<Member | null>(null);
  const add = useMutation(() => api<{ created: boolean; invited: boolean; role: string }>("/admin/team", { method: "POST", body: form }));
  const change = useMutation((id: string, roleId: string) => api(`/admin/team/${id}`, { method: "PUT", body: { roleId: roleId || null } }));
  const setSuper = useMutation((id: string, isSuperAdmin: boolean) => api(`/admin/team/${id}/super-admin`, { method: "PUT", body: { isSuperAdmin } }));

  if (loading && !data) return <PageSkeleton />;
  if (!data) return <ErrorState error={error} onRetry={reload} />;
  const assignable = data.roles.filter((r) => r.assignable);

  async function setRole(m: Member, roleId: string) {
    const role = data!.roles.find((r) => r.id === roleId);
    if (await change.run(m.id, roleId)) {
      toast({ tone: "success", title: role ? `${m.name} is now ${role.name}` : `Removed ${m.name} from the team` });
      reload();
    }
  }

  async function submit() {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = "Enter their full name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = "Enter their work email.";
    if (!form.roleId) e.roleId = "Choose a role.";
    setErrors(e);
    if (Object.keys(e).length) return;
    const r = await add.run();
    if (r) {
      toast({
        tone: "success",
        title: `${form.name.trim()} added as ${r.role}`,
        body: `${r.created ? "We created their account." : "They already had a SecretWish account, so it now has team access."} ${r.invited ? "An invitation email is on its way." : "Tell them to sign in to the operations app with this email."}`,
      });
      setAdding(false);
      setForm(blank);
      reload();
    }
  }

  const columns: Column<Member>[] = [
    {
      key: "name",
      header: "Person",
      render: (m) => (
        <span>
          <span className="block font-semibold">{m.name}{m.isMe && <span className="font-normal text-ink-500"> (you)</span>}</span>
          <span className="block text-xs text-ink-500">{m.email || "No email"}</span>
        </span>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (m) =>
        m.isSuperAdmin ? (
          <Badge tone="gold" icon={Crown}>Super admin{m.isDefaultSuperAdmin ? " · default" : ""}</Badge>
        ) : m.canEdit ? (
          <Select aria-label={`Role for ${m.name}`} value={m.roleId ?? ""} disabled={change.pending} onChange={(e) => setRole(m, e.target.value)}>
            {data.roles.map((r) => <option key={r.id} value={r.id} disabled={!r.assignable}>{r.name}</option>)}
            <option value="">Remove from team</option>
          </Select>
        ) : (
          <Badge tone="info">{m.role}</Badge>
        ),
    },
    { key: "hats", header: "Also", render: (m) => (m.isVendor ? <Badge>Vendor</Badge> : <span className="text-xs text-ink-500">Sends and receives</span>) },
    ...(data.isSuperAdmin
      ? [{
          key: "super",
          header: <span className="sr-only">Super admin</span>,
          render: (m: Member) =>
            m.isMe || m.isDefaultSuperAdmin ? null : (
              <Button size="sm" variant="ghost" icon={Crown} onClick={() => setSuperFor(m)}>{m.isSuperAdmin ? "Remove super admin" : "Make super admin"}</Button>
            ),
        } satisfies Column<Member>]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Team"
        description="Team accounts are only created here. People can't sign up as staff. Each person gets a role that decides which areas they see and what they can do; they keep sending, receiving and selling with the same account."
        actions={data.canManage && <Button icon={UserPlus} onClick={() => { setAdding(true); setErrors({}); setForm({ ...blank, roleId: assignable[0]?.id ?? "" }); }}>Add team member</Button>}
      />
      {!data.canManage && <Notice className="mb-6">You can see the team. Your role doesn&apos;t include adding people or changing roles.</Notice>}
      {(change.error || setSuper.error) && <Notice tone="danger" className="mb-6" title="Couldn't change team access">{(change.error ?? setSuper.error)!.message}</Notice>}
      <Card>
        <CardHeader
          title="Current team"
          description={<>Changes take effect on the person&apos;s next action and are audit-logged. Define what each role can do in <Link href="/roles" className="font-semibold text-plum-700 underline">Roles &amp; Privileges</Link>.</>}
        />
        <DataTable caption="SecretWish team members" columns={columns} rows={data.members} rowKey={(m) => m.id} />
      </Card>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add team member"
        description="If they already have a SecretWish account with this email, it gets team access. Otherwise we create one and they sign in with a one-time code sent to the email."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            <Button loading={add.pending} onClick={submit}>Add to team</Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="Full name" required error={errors.name}>
            {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.name} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="off" />}
          </Field>
          <Field label="Work email" required error={errors.email}>
            {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors.email} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" />}
          </Field>
          <Field label="Role" required error={errors.roleId} hint={assignable.find((r) => r.id === form.roleId)?.description}>
            {(id, d) => (
              <Select id={id} aria-describedby={d} value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
                {assignable.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            )}
          </Field>
          {!data.isSuperAdmin && <p className="text-xs text-ink-500">You can only give roles that don&apos;t exceed your own access.</p>}
          {add.error && <Notice tone="danger">{add.error.message}</Notice>}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!superFor}
        onClose={() => setSuperFor(null)}
        title={superFor?.isSuperAdmin ? `Remove ${superFor?.name}'s super admin access?` : `Make ${superFor?.name} a super admin?`}
        description={
          superFor?.isSuperAdmin
            ? "They'll become an Operations admin. They will no longer be able to define roles or manage the team."
            : "Super admins can see and do everything, add team members and define roles. Only give this to people you fully trust."
        }
        confirmLabel={superFor?.isSuperAdmin ? "Remove super admin" : "Make super admin"}
        tone={superFor?.isSuperAdmin ? "primary" : "danger"}
        pending={setSuper.pending}
        error={setSuper.error?.message}
        onConfirm={async () => {
          if (superFor && (await setSuper.run(superFor.id, !superFor.isSuperAdmin))) {
            toast({ tone: "success", title: superFor.isSuperAdmin ? `${superFor.name} is no longer a super admin` : `${superFor.name} is now a super admin` });
            setSuperFor(null);
            reload();
          }
        }}
      />
    </>
  );
}
