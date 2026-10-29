import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleDashed,
  Clock,
  CreditCard,
  Hourglass,
  type LucideIcon,
  PackageCheck,
  PauseCircle,
  RotateCcw,
  ShieldAlert,
  Truck,
  XCircle,
} from "lucide-react";

export type Tone = "neutral" | "plum" | "gold" | "success" | "warning" | "danger" | "info";

type Meta = { label: string; tone: Tone; icon: LucideIcon };

// One vocabulary for statuses across every app. Each status has text + icon, never colour alone.
const map: Record<string, Meta> = {
  // Orders
  PaymentPending: { label: "Payment pending", tone: "warning", icon: CreditCard },
  PaymentConfirmed: { label: "Payment confirmed", tone: "info", icon: CheckCircle2 },
  AwaitingVendorAcceptance: { label: "Awaiting vendor", tone: "gold", icon: Hourglass },
  Processing: { label: "Processing", tone: "plum", icon: CircleDashed },
  Dispatched: { label: "Dispatched", tone: "info", icon: Truck },
  Delivered: { label: "Delivered", tone: "success", icon: PackageCheck },
  Cancelled: { label: "Cancelled", tone: "neutral", icon: Ban },
  RefundRequested: { label: "Refund requested", tone: "warning", icon: RotateCcw },
  RefundCompleted: { label: "Refunded", tone: "neutral", icon: RotateCcw },
  DeliveryException: { label: "Delivery exception", tone: "danger", icon: AlertTriangle },
  // Payments
  Pending: { label: "Pending", tone: "warning", icon: Clock },
  Succeeded: { label: "Succeeded", tone: "success", icon: CheckCircle2 },
  Failed: { label: "Failed", tone: "danger", icon: XCircle },
  Refunded: { label: "Refunded", tone: "neutral", icon: RotateCcw },
  PartiallyRefunded: { label: "Part refunded", tone: "neutral", icon: RotateCcw },
  // Vendors / products
  Approved: { label: "Approved", tone: "success", icon: CheckCircle2 },
  Rejected: { label: "Rejected", tone: "danger", icon: XCircle },
  Suspended: { label: "Suspended", tone: "danger", icon: PauseCircle },
  Draft: { label: "Draft", tone: "neutral", icon: CircleDashed },
  PendingReview: { label: "Pending review", tone: "gold", icon: Hourglass },
  OutOfStock: { label: "Out of stock", tone: "warning", icon: AlertTriangle },
  // Cases / tickets
  Open: { label: "Open", tone: "warning", icon: CircleDashed },
  InReview: { label: "In review", tone: "plum", icon: Hourglass },
  AwaitingEvidence: { label: "Awaiting evidence", tone: "gold", icon: Clock },
  Closed: { label: "Closed", tone: "neutral", icon: CheckCircle2 },
  Resolved: { label: "Resolved", tone: "success", icon: CheckCircle2 },
  // Payouts
  Paid: { label: "Paid", tone: "success", icon: CheckCircle2 },
  OnHold: { label: "On hold", tone: "warning", icon: PauseCircle },
  Matched: { label: "Matched", tone: "success", icon: CheckCircle2 },
  Exception: { label: "Exception", tone: "danger", icon: ShieldAlert },
  // Wishlists / quotes
  Private: { label: "Private", tone: "neutral", icon: ShieldAlert },
  Link: { label: "Link only", tone: "plum", icon: CircleDashed },
  Public: { label: "Public", tone: "gold", icon: CheckCircle2 },
  Quoted: { label: "Quoted", tone: "plum", icon: CircleDashed },
  Accepted: { label: "Accepted", tone: "success", icon: CheckCircle2 },
  Submitted: { label: "Submitted", tone: "info", icon: Clock },
  Declined: { label: "Declined", tone: "neutral", icon: XCircle },
  // Derived sub-statuses
  "Not started": { label: "Not started", tone: "neutral", icon: CircleDashed },
  "Awaiting acceptance": { label: "Awaiting acceptance", tone: "gold", icon: Hourglass },
  Fulfilled: { label: "Fulfilled", tone: "success", icon: PackageCheck },
  "In transit": { label: "In transit", tone: "info", icon: Truck },
  "Not dispatched": { label: "Not dispatched", tone: "neutral", icon: CircleDashed },
  Requested: { label: "Requested", tone: "warning", icon: RotateCcw },
  None: { label: "—", tone: "neutral", icon: CircleDashed },
  Eligible: { label: "Eligible", tone: "success", icon: CheckCircle2 },
};

export function statusMeta(status: string | null | undefined): Meta {
  if (!status) return { label: "—", tone: "neutral", icon: CircleDashed };
  return map[status] ?? { label: status.replace(/([a-z])([A-Z])/g, "$1 $2"), tone: "neutral", icon: CircleDashed };
}

export const toneClasses: Record<Tone, string> = {
  neutral: "bg-ink-100 text-ink-700 ring-ink-200",
  plum: "bg-plum-50 text-plum-700 ring-plum-200",
  gold: "bg-gold-100 text-gold-700 ring-gold-300",
  success: "bg-success-50 text-success-700 ring-success-600/20",
  warning: "bg-warning-50 text-warning-700 ring-warning-600/20",
  danger: "bg-danger-50 text-danger-700 ring-danger-600/20",
  info: "bg-info-50 text-info-600 ring-info-600/20",
};

export const ORDER_STATUSES = [
  "PaymentPending",
  "PaymentConfirmed",
  "AwaitingVendorAcceptance",
  "Processing",
  "Dispatched",
  "Delivered",
  "DeliveryException",
  "RefundRequested",
  "RefundCompleted",
  "Cancelled",
] as const;

export const tintClasses: Record<string, string> = {
  lavender: "bg-lavender-tint",
  gold: "bg-gold-tint",
  ivory: "bg-ivory-tint",
  rose: "bg-rose-tint",
  sage: "bg-sage-tint",
  plum: "bg-plum-tint",
};
