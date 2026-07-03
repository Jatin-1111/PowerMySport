import type { Metadata } from "next";
import { buildMetadata, fetchPublicData } from "@/lib/seo";
import type { CommunityMemberProfile } from "@/modules/community/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const { userId } = await params;
  const profile = await fetchPublicData<CommunityMemberProfile>(
    `/community/players/${userId}/profile`,
  );

  const name = profile?.isIdentityPublic
    ? profile.displayName
    : profile?.alias || "Community Member";

  const sports = profile?.sports?.length
    ? ` — ${profile.sports.slice(0, 3).join(", ")}`
    : "";

  // Member profiles carry personal data, so they are intentionally noindex.
  return buildMetadata({
    title: `${name}${sports}`,
    description:
      "View a PowerMySport community member's profile, sports, and activity.",
    path: `/members/${userId}`,
    noindex: true,
  });
}

export default function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
