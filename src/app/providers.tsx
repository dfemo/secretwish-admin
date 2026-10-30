"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { BarChart3, Boxes, CreditCard, FileClock, Gift, HandCoins, LayoutDashboard, LifeBuoy, Package, RotateCcw, Settings, ShieldCheck, Store, Users, UserCog } from "lucide-react";
import { SessionProvider, useSession } from "@/shared/lib/session";
import { SidebarShell, type NavSection } from "@/shared/layout/shell";
import { ToastProvider } from "@/shared/ui/overlay";

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
      { href: "/settings", label: "Settings & Permissions", icon: Settings },
    ],
  },
];

const roleTitle: Record<string, string> = { OpsAdmin: "Operations admin", Finance: "Finance", Support: "Support agent" };

function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { persona } = useSession();
  return (
    <SidebarShell sections={sections} suffix="Ops" subtitle={roleTitle[persona.role] ?? persona.role} searchPlaceholder="Search orders, vendors, products…" onSearch={(q) => router.push(`/orders?search=${encodeURIComponent(q)}`)}>
      {children}
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
            <p className="mt-4 max-w-md text-plum-200">Orders, vendors, refunds, payouts and support — with privacy controls that change with your role. Sign in with your SecretWish account; access follows your team role.</p>
          </>
        }
      >
        <Shell>{children}</Shell>
      </SessionProvider>
    </ToastProvider>
  );
}
