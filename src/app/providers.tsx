"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { BarChart3, Boxes, CreditCard, FileClock, Gift, HandCoins, KeyRound, LayoutDashboard, LifeBuoy, Lock, Package, RotateCcw, Settings, ShieldCheck, Store, Users, UserCog } from "lucide-react";
import { SessionProvider } from "@/shared/lib/session";
import { SidebarShell, type NavSection } from "@/shared/layout/shell";
import { ToastProvider } from "@/shared/ui/overlay";
import { EmptyState } from "@/shared/ui/primitives";
import { AccessProvider, areaPermission, permissionFor, useAccess } from "@/lib/access";

const sections: NavSection[] = [
  { items: [{ href: "/", label: "Overview", icon: LayoutDashboard }] },
  {
    title: "Marketplace",
    items: [
      { href: "/orders", label: "Orders & Fulfilment", icon: Package },
      { href: "/customers", label: "Customers & Recipients", icon: Users },
      { href: "/vendors", label: "Vendors & Approvals", icon: Store },
      { href: "/products", label: "Products & Categories", icon: Boxes },
      { href: "/wishlists", label: "Wishlists & Campaigns", icon: Gift },
    ],
  },
  {
    title: "Money",
    items: [
      { href: "/payments", label: "Payments & Transactions", icon: CreditCard },
      { href: "/refunds", label: "Refunds & Disputes", icon: RotateCcw },
      { href: "/payouts", label: "Vendor Payouts", icon: HandCoins },
    ],
  },
  { title: "Care", items: [{ href: "/support", label: "Customer Support", icon: LifeBuoy }] },
  { title: "Insights", items: [{ href: "/reports", label: "Reports & Analytics", icon: BarChart3 }] },
  {
    title: "Governance",
    items: [
      { href: "/privacy", label: "Privacy & Security", icon: ShieldCheck },
      { href: "/audit", label: "Audit Logs", icon: FileClock },
      { href: "/team", label: "Team", icon: UserCog },
      { href: "/roles", label: "Roles & Privileges", icon: KeyRound },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { can, role } = useAccess();
  // Only show the areas this person's team role opens; the API refuses the rest anyway.
  const visible = sections
    .map((s) => ({ ...s, items: s.items.filter((it) => !areaPermission[it.href] || can(areaPermission[it.href])) }))
    .filter((s) => s.items.length > 0);
  const needed = permissionFor(pathname);
  const home = visible[0]?.items[0]?.href;
  // Roles without the dashboard land on the first area they can use.
  useEffect(() => {
    if (pathname === "/" && !can("overview.view") && home && home !== "/") router.replace(home);
  }, [pathname, can, home, router]);
  return (
    <SidebarShell sections={visible} suffix="Ops" subtitle={role} searchPlaceholder="Search orders, vendors, products…" onSearch={(q) => router.push(`/orders?search=${encodeURIComponent(q)}`)}>
      {needed && !can(needed) ? (
        <EmptyState icon={Lock} title="You don't have access to this area" description={`Your team role (${role}) doesn't include it. Ask a super admin if you need it.`} />
      ) : (
        children
      )}
    </SidebarShell>
  );
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <SessionProvider
        app="admin"
        intro={
          <>
            <h1 className="font-display text-4xl leading-tight font-semibold md:text-5xl">
              The control room for <span className="text-gold-400">discreet gifting</span>.
            </h1>
            <p className="mt-4 max-w-md text-plum-200">Orders, vendors, refunds, payouts and support — with privacy controls that change with your role. Sign in with your SecretWish account; access follows the team role a super admin gives you.</p>
          </>
        }
      >
        <AccessProvider>
          <Shell>{children}</Shell>
        </AccessProvider>
      </SessionProvider>
    </ToastProvider>
  );
}
