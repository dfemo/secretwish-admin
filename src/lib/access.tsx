"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useApi } from "@/shared/lib/api";
import { ErrorState, PageSkeleton } from "@/shared/ui/primitives";

/** Permission keys from the API (StaffPermissions). The API enforces them; the app uses them to hide what you can't use. */
export type Permission =
  | "overview.view" | "orders.view" | "orders.manage" | "orders.reveal" | "customers.view" | "people.full" | "vendors.view" | "vendors.manage"
  | "products.view" | "products.review" | "wishlists.view" | "wishlists.manage" | "payments.view" | "refunds.view" | "refunds.manage" | "refunds.decide"
  | "payouts.view" | "payouts.manage" | "support.view" | "support.manage" | "reports.view" | "audit.view" | "privacy.view"
  | "settings.view" | "settings.manage" | "team.view" | "team.manage";

type AccessData = { isSuperAdmin: boolean; roleId: string | null; role: string; dataAccess: "OpsAdmin" | "Finance" | "Support"; permissions: Permission[] };
export type Access = AccessData & { can: (p: Permission) => boolean };

const Ctx = createContext<Access | null>(null);

/** Which permission opens each admin area. */
export const areaPermission: Record<string, Permission> = {
  "/": "overview.view",
  "/orders": "orders.view",
  "/hub": "orders.view",
  "/deliveries": "orders.view",
  "/requests": "orders.view",
  "/customers": "customers.view",
  "/vendors": "vendors.view",
  "/products": "products.view",
  "/wishlists": "wishlists.view",
  "/payments": "payments.view",
  "/cash-gifts": "payments.view",
  "/refunds": "refunds.view",
  "/payouts": "payouts.view",
  "/support": "support.view",
  "/reports": "reports.view",
  "/privacy": "privacy.view",
  "/audit": "audit.view",
  "/team": "team.view",
  "/roles": "team.view",
  "/settings": "settings.view",
};

export function permissionFor(pathname: string): Permission | undefined {
  if (pathname === "/") return areaPermission["/"];
  const area = Object.keys(areaPermission).find((a) => a !== "/" && (pathname === a || pathname.startsWith(`${a}/`)));
  return area ? areaPermission[area] : undefined;
}

export function AccessProvider({ children }: { children: ReactNode }) {
  const { data, error, loading, reload } = useApi<AccessData>("/admin/me/access");
  if (loading && !data) return <PageSkeleton />;
  if (!data) return <ErrorState error={error} onRetry={reload} />;
  const set = new Set(data.permissions);
  const value: Access = { ...data, can: (p) => data.isSuperAdmin || set.has(p) };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAccess() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAccess must be used inside AccessProvider");
  return v;
}
