/** The engines that send webhooks, each with its own page under /webhooks. */
export const ENGINES = ["Paystack", "Flutterwave", "Stripe"] as const;
export type Engine = (typeof ENGINES)[number];
