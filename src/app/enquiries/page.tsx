"use client";

import { PageHeader } from "@/shared/ui/primitives";
import { WebsiteEnquiries } from "./enquiries";

/** Messages from the website's contact form, kept apart from support tickets so each queue stays manageable at any size. */
export default function EnquiriesPage() {
  return (
    <>
      <PageHeader title="Website enquiries" description="Messages sent through the website's contact form. Open one to see who sent it and reply by email; opening is recorded in the audit log." />
      <WebsiteEnquiries />
    </>
  );
}
