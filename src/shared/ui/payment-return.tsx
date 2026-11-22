"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { api } from "../lib/api";
import { ButtonLink, Card, Spinner } from "./primitives";

type Result = {
  status: "Paid" | "Pending" | "Failed"; message: string | null; orderId: string | null; cashGiftId: string | null; wishlistToken: string | null;
  provider: string; currency: string; amount: number; plan: string | null;
};

/** A path in this app to go back to (never another site). */
const safe = (next: string | null) => (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : null);

/**
 * Where Paystack, Flutterwave and Stripe send people back after checkout. The payment is checked with the provider (the provider's
 * webhook does the same, so whichever comes first counts it), retrying for a little while if it's still processing. A paid plan
 * carries on to where the person was (e.g. the gift checkout) by itself.
 */
export function PaymentReturn({ home = "/", homeLabel = "Back to VeilWish (SecretWish)" }: { home?: string; homeLabel?: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const ref = params.get("ref") ?? params.get("reference") ?? params.get("tx_ref") ?? "";
  const cancelled = params.get("cancelled") === "1" || params.get("status") === "cancelled";
  const back = safe(params.get("next"));
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tries = useRef(0);

  useEffect(() => {
    if (!ref) return;
    let stop = false;
    const check = async () => {
      try {
        const r = await api<Result>(`/payments/${encodeURIComponent(ref)}/verify`, { method: "POST" });
        if (stop) return;
        setResult(r);
        // Bank transfers and some cards take a moment: keep checking for about half a minute.
        if (r.status === "Pending" && !cancelled && ++tries.current < 10) setTimeout(check, 3000);
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : "We couldn't check your payment.");
      }
    };
    check();
    return () => { stop = true; };
  }, [ref, cancelled]);

  // A paid plan goes straight back to what the person was doing.
  useEffect(() => {
    if (result?.status !== "Paid" || !result.plan || !back) return;
    const t = setTimeout(() => router.replace(back), 1500);
    return () => clearTimeout(t);
  }, [result, back, router]);

  const next = result?.plan ? { href: back ?? home, label: back ? "Continue" : homeLabel }
    : result?.orderId ? { href: `/orders/${result.orderId}`, label: "View your order" }
    : result?.wishlistToken ? { href: `/w/${result.wishlistToken}`, label: "Back to the wishlist" }
    : { href: back ?? home, label: back ? "Go back" : homeLabel };

  return (
    <div className="mx-auto max-w-md py-10">
      <Card className="p-8 text-center">
        {!ref ? (
          <p className="text-sm text-ink-500">There&apos;s no payment to check here.</p>
        ) : error ? (
          <>
            <XCircle className="mx-auto size-12 text-danger-600" aria-hidden />
            <h1 className="mt-3 font-display text-2xl font-semibold text-plum-900">We couldn&apos;t check your payment</h1>
            <p className="mt-2 text-sm text-ink-500">{error} If you were charged, it will still be counted once the payment provider confirms it.</p>
          </>
        ) : !result ? (
          <Spinner label="Checking your payment" />
        ) : result.status === "Paid" ? (
          <>
            <CheckCircle2 className="mx-auto size-12 text-success-600" aria-hidden />
            <h1 className="mt-3 font-display text-2xl font-semibold text-plum-900">{result.plan ? "Your plan is active" : "Payment received"}</h1>
            <p className="mt-2 text-sm text-ink-500">
              Thank you! {result.provider} confirmed your payment of {result.currency} {result.amount.toLocaleString()}.
              {result.plan && <> You&apos;re now on {result.plan}.{back && " Taking you back…"}</>}
            </p>
          </>
        ) : result.status === "Failed" ? (
          <>
            <XCircle className="mx-auto size-12 text-danger-600" aria-hidden />
            <h1 className="mt-3 font-display text-2xl font-semibold text-plum-900">Payment didn&apos;t go through</h1>
            <p className="mt-2 text-sm text-ink-500">{result.message ?? "Nothing was taken. You can try again."}</p>
          </>
        ) : cancelled ? (
          <>
            <XCircle className="mx-auto size-12 text-ink-400" aria-hidden />
            <h1 className="mt-3 font-display text-2xl font-semibold text-plum-900">Payment cancelled</h1>
            <p className="mt-2 text-sm text-ink-500">Nothing was taken. {result.plan ? "Your plan hasn't changed." : "Your gift is saved, so you can pay whenever you're ready."}</p>
          </>
        ) : (
          <>
            <Clock className="mx-auto size-12 text-gold-600" aria-hidden />
            <h1 className="mt-3 font-display text-2xl font-semibold text-plum-900">Still processing</h1>
            <p className="mt-2 text-sm text-ink-500">
              {result.provider} hasn&apos;t confirmed it yet. {result.plan ? "Your plan switches on" : "We'll update your gift"} as soon as it does; there&apos;s no need to pay again.
            </p>
          </>
        )}
        {ref && (result || error) && <ButtonLink href={next.href} className="mt-6">{next.label}</ButtonLink>}
        {!ref && <Link href={home} className="mt-4 inline-block text-sm font-semibold text-plum-700">{homeLabel}</Link>}
      </Card>
    </div>
  );
}
