"use client";

import Link from "next/link";
import { useState } from "react";
import { Lock, ShieldPlus, UsersRound } from "lucide-react";
import { api, useApi, useMutation, usePagedApi } from "@/shared/lib/api";
import { useAccess } from "@/lib/access";
import { date } from "@/shared/lib/format";
import { DataTable, PagedFooter, type Column } from "@/shared/ui/data";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Field, PageHeader, SearchInput, Select, Spinner, Tabs } from "@/shared/ui/primitives";
import { Modal, useToast } from "@/shared/ui/overlay";

type Account = {
  id: string; name: string; email: string | null; phone: string | null; city: string; plan: string; createdAt: string;
  isSender: boolean; isRecipient: boolean; store: string | null; isSuperAdmin: boolean; isStaff: boolean; role: string | null; roleId: string | null;
  blacklisted: boolean; hasDateOfBirth: boolean; isMe: boolean;
};
type Role = { id: string; name: string; description: string; dataAccess: string };
type Filter = "all" | "customer" | "vendor" | "staff" | "blacklisted";

/** Super admins: every account on SecretWish, and making an existing sender, recipient or vendor an admin with a limited team role. */
export default function UsersPage() {
  const { isSuperAdmin } = useAccess();
  if (!isSuperAdmin)
    return <EmptyState icon={Lock} title="Super admins only" description="Only a VeilWish (SecretWish) super admin can see every account and make people admins." />;
  return <Users />;
}

function Users() {
  const [type, setType] = useState<Filter>("all");
  const { data, items, error, loading, reload, setPage, search, setSearch } = usePagedApi<Account>("/admin/users", { type }, 25);
  const roles = useApi<{ roles: Role[] }>("/admin/roles");
  const toast = useToast();
  const [promote, setPromote] = useState<Account | null>(null);
  const [roleId, setRoleId] = useState("");
  const make = useMutation((id: string, rid: string) => api<{ role: string }>(`/admin/users/${id}/make-admin`, { method: "POST", body: { roleId: rid } }));
  const c = data?.counts;

  const columns: Column<Account>[] = [
    {
      key: "n",
      header: "Account",
      render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar name={u.name} size={32} />
          <div className="min-w-0">
            <p className="font-semibold">
              <Link href={`/customers/${u.id}`} className="text-plum-800 hover:underline">{u.name}</Link>
              {u.isMe && <span className="ml-1 text-xs font-normal text-ink-500">(you)</span>}
            </p>
            <p className="break-all text-xs text-ink-500">{u.email ?? u.phone ?? "No contact details"}</p>
          </div>
        </div>
      ),
    },
    {
      key: "does",
      header: "Uses VeilWish (SecretWish) as",
      render: (u) => (
        <div className="flex flex-wrap gap-1">
          {u.isSender && <Badge tone="plum">Sender</Badge>}
          {u.isRecipient && <Badge tone="info">Recipient</Badge>}
          {u.store && <Badge tone="gold">Vendor · {u.store}</Badge>}
          {!u.isSender && !u.isRecipient && !u.store && <span className="text-xs text-ink-400">No activity yet</span>}
          {u.blacklisted && <Badge tone="danger">Blacklisted</Badge>}
        </div>
      ),
    },
    { key: "city", header: "City", hideOnMobile: true, render: (u) => u.city || "—" },
    { key: "joined", header: "Joined", hideOnMobile: true, render: (u) => <span className="text-xs">{date(u.createdAt)}</span> },
    {
      key: "role",
      header: "Admin access",
      render: (u) =>
        u.isStaff ? (
          <Badge tone={u.isSuperAdmin ? "gold" : "success"}>{u.role ?? "Team"}</Badge>
        ) : (
          <Button size="sm" variant="secondary" icon={ShieldPlus} disabled={u.blacklisted} title={u.blacklisted ? "Lift the blacklist first" : undefined}
            onClick={() => { setPromote(u); setRoleId(""); make.setError(null); }}>
            Make admin
          </Button>
        ),
    },
  ];

  return (
    <>
      <PageHeader title="All users" description="Every account on VeilWish (SecretWish): senders, recipients, vendors and the team. Give an existing account a team role to make them an admin with just that role's permissions." />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
          <Tabs
            value={type}
            onChange={setType}
            tabs={[
              { value: "all", label: "All", count: c?.all },
              { value: "customer", label: "Customers", count: c?.customer },
              { value: "vendor", label: "Vendors", count: c?.vendor },
              { value: "staff", label: "Team", count: c?.staff },
              { value: "blacklisted", label: "Blacklisted", count: c?.blacklisted },
            ]}
          />
          <SearchInput value={search} onChange={setSearch} label="Search users" placeholder="Name, email or phone" className="min-w-[200px] flex-1" />
        </div>
        {loading && !data && <Spinner />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {data && <DataTable caption="All users" columns={columns} rows={items ?? []} rowKey={(u) => u.id} empty={<EmptyState icon={UsersRound} title="No matches" />} />}
        <PagedFooter data={data} onPage={setPage} />
      </Card>

      <Modal
        open={!!promote}
        onClose={() => setPromote(null)}
        title={promote ? `Make ${promote.name} an admin` : ""}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPromote(null)}>Cancel</Button>
            <Button loading={make.pending} disabled={!roleId} onClick={async () => {
              if (!promote) return;
              const r = await make.run(promote.id, roleId);
              if (r) {
                toast({ tone: "success", title: `${promote.name} is now ${r.role}`, body: "They keep everything their account already does, and can now sign in to the operations app." });
                setPromote(null);
                reload();
              }
            }}>Make admin</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-700">
            They&apos;ll get only the permissions of the role you choose, and keep sending, receiving{promote?.store ? " and selling" : ""} as before. Change or remove their role later on the Team page.
          </p>
          <Field label="Team role" required>
            {(id) => (
              <Select id={id} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                <option value="">Choose a role…</option>
                {roles.data?.roles.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
              </Select>
            )}
          </Field>
          {roleId && <p className="text-xs text-ink-500">{roles.data?.roles.find((r) => r.id === roleId)?.description}</p>}
          {make.error && <p role="alert" className="rounded-xl bg-danger-50 px-3 py-2 text-[13px] font-medium text-danger-700">{make.error.message}</p>}
        </div>
      </Modal>
    </>
  );
}
