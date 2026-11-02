"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { Button, cx } from "./primitives";
import { Modal } from "./overlay";

/** An invoice a vendor attached to a quote. `pages` are images of each page (null: embed the PDF itself). */
export type Invoice = { url: string; fileName: string; contentType: string; pages: string[] | null };

/** Shows an invoice inline, page by page, with no download control. */
export function InvoicePages({ invoice, className }: { invoice: Invoice; className?: string }) {
  if (!invoice.pages)
    return <iframe src={`${invoice.url}#toolbar=0&navpanes=0`} title={invoice.fileName} className={cx("h-[70vh] w-full rounded-xl border border-ink-200 bg-ink-50", className)} />;
  return (
    <div className={cx("space-y-3", className)} onContextMenu={(e) => e.preventDefault()}>
      {invoice.pages.map((src, n) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt={invoice.pages!.length > 1 ? `${invoice.fileName}, page ${n + 1} of ${invoice.pages!.length}` : invoice.fileName}
          draggable={false}
          loading="lazy"
          className="w-full select-none rounded-xl border border-ink-200 bg-white"
        />
      ))}
    </div>
  );
}

/** A "View invoice" button that opens the invoice in a preview dialog. */
export function InvoiceButton({ invoice, title = "Invoice" }: { invoice: Invoice; title?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="secondary" icon={FileText} onClick={() => setOpen(true)}>View invoice</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} description={invoice.fileName} size="lg">
        <InvoicePages invoice={invoice} />
      </Modal>
    </>
  );
}
