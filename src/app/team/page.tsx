"use client";

import { useState } from "react";
import { api, useApi, useMutation } from "@/shared/lib/api";
import { DataTable, type Column } from "@/shared/ui/data";
import { Badge, Card, CardHeader, ErrorState, Notice, PageHeader, PageSkeleton, SearchInput, Select } from "@/shared/ui/primitives";
import { useToast } from "@/shared/ui/overlay";

type Member = { id: string; name: string; email: string | null; staffRole: string | null; isVendor: boolean; createdAt: string };
type Data = { canEdit: boolean; staff: Member[]; matches: Member[] };

const roles = [
  { value: "", label: "No team access" },
  { value: "OpsAdmin", label: "Operations admin" },
  { value: "Finance", label: "Finance" },
  { value: "Support", label: "Support" },
];

export default function TeamPage() {
  const [search, setSearch] = useState("");
  const { data, error, loading, reload } = useApi<Data>(`/admin/team?search=${encodeURIComponent(search)}`);
  const toast = useToast();
  const change = useMutation((id: string, staffRole: string) => api(`/admin/team/${id}`, { method: "PUT", body: { staffRole: staffRole || null } }));

  if (loading) return error ? <ErrorState error={error} onRetry={reload} /> : <PageSkeleton />;
  if (!data) return <ErrorState error={error} onRetry={reload} />;

  async function setRole(m: Member, staffRole: string) {
    if (await change.run(m.id, staffRole)) toast({ tone: "success", title: staffRole ? `${m.name} is now ${staffRole}` : `Removed ${m.name}'s team access` });
  }

  const columns: Column<Member>[] = [
    { key: "name", header: "Person", render: (m) => <span><span className="block font-semibold">{m.name}</span><span className="block text-xs text-ink-500">{m.email || "No email"}</span></span> },
    { key: "hats", header: "Also", render: (m) => (m.isVendor ? <Badge>Vendor</Badge> : <span className="text-xs text-ink-500">Sends and receives</span>) },
    {
      key: "role",
      header: "Team access",
      render: (m) =>
        data.canEdit ? (
          <Select aria-label={`Team access for ${m.name}`} value={m.staffRole ?? ""} disabled={change.pending} onChange={(e) => setRole(m, e.target.value)}>
            {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        ) : (
          <Badge tone="gold">{m.staffRole}</Badge>
        ),
    },
  ];

  return (
    <>
      <PageHeader title="Team" description="Everyone uses one SecretWish account. Give a person a staff role here and the operations app opens for them; they keep sending, receiving and selling as before." />
      {!data.canEdit && <Notice className="mb-6">Only operations admins can change team access.</Notice>}
      {change.error && <Notice className="mb-6" title="Couldn't change team access">{change.error.message}</Notice>}
      <div className="grid gap-6">
        <Card>
          <CardHeader title="Current team" description="Changes take effect straight away (the person may need to reload the app) and are audit-logged." />
          <DataTable caption="SecretWish team members" columns={columns} rows={data.staff} rowKey={(m) => m.id} />
        </Card>
        {data.canEdit && (
          <Card>
            <CardHeader title="Add someone" description="Find their account by name, email or phone. They need to have signed up first." />
            <div className="p-5 pb-0">
              <SearchInput value={search} onChange={setSearch} placeholder="Search accounts…" label="Search accounts" />
            </div>
            <DataTable
              caption="Accounts matching your search"
              columns={columns}
              rows={data.matches.filter((m) => !m.staffRole)}
              rowKey={(m) => m.id}
              empty={<p className="p-5 text-sm text-ink-500">{search.trim().length < 2 ? "Type at least 2 characters to search." : "No accounts match."}</p>}
            />
          </Card>
        )}
      </div>
    </>
  );
}
