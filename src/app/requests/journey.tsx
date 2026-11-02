import { cx } from "@/shared/ui/primitives";

const steps = ["Requested", "Quoted", "Vendor chosen", "Paid", "Preparing", "Dispatched", "Delivered"];

/** Seven dots from request to delivery; a stopped request (closed, cancelled, refunded) is shown in red at the step it reached. */
export function Journey({ step, stage }: { step: number; stage: string }) {
  const stopped = step < 0;
  return (
    <div className="min-w-[230px]">
      <ol className="flex items-center gap-1" aria-label={`Progress: ${stage}`}>
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-1" title={s}>
            <span className={cx("size-2.5 rounded-full", stopped ? "bg-danger-300" : i <= step ? "bg-plum-700" : "bg-ink-200", i === step && !stopped && "ring-4 ring-plum-100")} />
            {i < steps.length - 1 && <span className={cx("h-0.5 w-4", !stopped && i < step ? "bg-plum-700" : "bg-ink-200")} />}
          </li>
        ))}
      </ol>
      <p className={cx("mt-1.5 text-xs font-semibold", stopped ? "text-danger-700" : step === 6 ? "text-success-700" : "text-plum-800")}>{stage}</p>
    </div>
  );
}
