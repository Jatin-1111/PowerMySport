import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";

/**
 * `generateMetadata`, not a static object: a static `path: "/join"` emitted the
 * same canonical for every invite code, declaring thousands of distinct URLs to
 * be one page. Harmless while this is `noindex`, but it is the sort of thing
 * that silently becomes a bug the day someone flips that flag.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  return buildMetadata({
    title: "Join Group",
    description: "Join a PowerMySport community group using an invite link.",
    path: `/join/${code}`,
    noindex: true,
  });
}

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
