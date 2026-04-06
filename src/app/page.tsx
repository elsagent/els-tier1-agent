'use client';

import dynamic from 'next/dynamic';

const tier = process.env.NEXT_PUBLIC_DEFAULT_TIER || 'tier1';

const Tier1Page = dynamic(() => import('./(protected)/tier1/page'));
const Tier2Page = dynamic(() => import('./(protected)/tier2/page'));

export default function Home() {
  if (tier === 'tier2') return <Tier2Page />;
  return <Tier1Page />;
}
