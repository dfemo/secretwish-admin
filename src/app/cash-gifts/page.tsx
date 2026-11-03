"use client";

import { PageHeader } from "@/shared/ui/primitives";
import { CashGiftsCard } from "./cash-gifts-card";

export default function CashGiftsPage() {
  return (
    <>
      <PageHeader
        title="Cash gifts"
        description="Money senders gave instead of a gift. Transfer it once the recipient has added bank details; they then confirm it arrived and can thank the sender."
      />
      <CashGiftsCard />
    </>
  );
}
