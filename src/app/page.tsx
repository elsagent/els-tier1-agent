'use client';

// Durable cutover: els-customer (NEXT_PUBLIC_DEFAULT_TIER=tier1) and els-tech
// (=tier2) keep their URLs but now serve the durable, provider-agnostic widget
// via DurableAgentFrame. The old OpenAI ChatKit tier pages remain in-tree under
// /(protected)/tier1 and /tier2 as a rollback path but are no longer the entry.
import DurableAgentFrame from '../components/DurableAgentFrame';

const tier = process.env.NEXT_PUBLIC_DEFAULT_TIER || 'tier1';

export default function Home() {
  return <DurableAgentFrame tier={tier} />;
}
