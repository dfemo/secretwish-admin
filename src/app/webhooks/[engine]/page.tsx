import { notFound } from "next/navigation";
import { ENGINES } from "../engines";
import { WebhookLog } from "../webhook-log";

export function generateStaticParams() {
  return ENGINES.map((e) => ({ engine: e.toLowerCase() }));
}

export default async function EngineWebhooksPage({ params }: { params: Promise<{ engine: string }> }) {
  const { engine } = await params;
  const match = ENGINES.find((e) => e.toLowerCase() === engine.toLowerCase());
  if (!match) notFound();
  return <WebhookLog engine={match} />;
}
