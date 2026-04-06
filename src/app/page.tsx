import { redirect } from "next/navigation";

export default function Home() {
  const tier = process.env.NEXT_PUBLIC_DEFAULT_TIER || "tier1";
  redirect(`/${tier}`);
}
