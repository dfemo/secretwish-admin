"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { Button, cx, Field, Textarea } from "./primitives";

// ---------------- Modal ----------------
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusables = () => Array.from(node?.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])") ?? []).filter((el) => !el.hasAttribute("disabled"));
    (focusables().find((el) => el.tagName !== "BUTTON") ?? focusables()[0])?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const f = focusables();
        if (f.length === 0) return;
        if (e.shiftKey && document.activeElement === f[0]) {
          e.preventDefault();
          f[f.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
          e.preventDefault();
          f[0].focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;
  const w = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-plum-950/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} className={cx("relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-[var(--shadow-pop)] sm:rounded-2xl", w)}>
        <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
          <div>
            <h2 id={titleId} className="font-display text-xl font-semibold text-plum-900">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100" aria-label="Close dialog">
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-ink-100 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Confirmation for consequential actions. When `reasonLabel` is set a written reason is
 * required (it is stored in the audit log by the API).
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  tone = "primary",
  reasonLabel,
  reasonPlaceholder,
  pending,
  error,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  tone?: "primary" | "danger" | "gold";
  reasonLabel?: string;
  reasonPlaceholder?: string;
  pending?: boolean;
  error?: string | null;
  children?: ReactNode;
}) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (open) {
      setReason("");
      setTouched(false);
    }
  }, [open]);
  const missing = !!reasonLabel && reason.trim().length < 3;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={tone}
            loading={pending}
            onClick={() => {
              setTouched(true);
              if (!missing) onConfirm(reason.trim());
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {tone === "danger" && (
          <div className="flex gap-2 rounded-xl bg-danger-50 px-3 py-2.5 text-[13px] text-danger-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> This action has consequences for customers or vendors and is recorded in the audit log.
          </div>
        )}
        {description && <div className="text-sm text-ink-700">{description}</div>}
        {children}
        {reasonLabel && (
          <Field label={reasonLabel} required error={touched && missing ? "Please give a reason (at least 3 characters)." : null}>
            {(id, d) => <Textarea id={id} aria-describedby={d} aria-invalid={touched && missing} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={reasonPlaceholder} />}
          </Field>
        )}
        {error && (
          <p className="rounded-xl bg-danger-50 px-3 py-2 text-[13px] font-medium text-danger-700" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

// ---------------- Drawer (mobile nav, detail panels) ----------------
export function Drawer({ open, onClose, children, side = "left", label }: { open: boolean; onClose: () => void; children: ReactNode; side?: "left" | "right"; label: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={label}>
      <div className="absolute inset-0 bg-plum-950/40" onClick={onClose} aria-hidden />
      <div className={cx("absolute top-0 bottom-0 w-[86%] max-w-sm overflow-y-auto bg-white shadow-[var(--shadow-pop)]", side === "left" ? "left-0" : "right-0")}>{children}</div>
    </div>
  );
}

// ---------------- Toasts ----------------
type Toast = { id: number; tone: "success" | "error" | "info"; title: string; body?: string };
const ToastCtx = createContext<(t: Omit<Toast, "id">) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((x) => [...x, { ...t, id }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 5000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-20 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2 md:bottom-4" aria-live="polite">
        {toasts.map((t) => {
          const Icon = t.tone === "success" ? CheckCircle2 : t.tone === "error" ? XCircle : Info;
          return (
            <div key={t.id} className="pointer-events-auto flex gap-3 rounded-2xl border border-ink-200 bg-white p-3.5 shadow-[var(--shadow-pop)]" role={t.tone === "error" ? "alert" : "status"}>
              <Icon className={cx("mt-0.5 size-5 shrink-0", t.tone === "success" ? "text-success-600" : t.tone === "error" ? "text-danger-600" : "text-plum-600")} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-900">{t.title}</p>
                {t.body && <p className="mt-0.5 text-[13px] text-ink-500">{t.body}</p>}
              </div>
              <button type="button" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="self-start rounded p-0.5 text-ink-400 hover:text-ink-700" aria-label="Dismiss">
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
