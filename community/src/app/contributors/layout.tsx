import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Contributor Leaderboard",
  description:
    "See the players and coaches who share the most valuable knowledge in the PowerMySport community.",
  path: "/contributors",
  noindex: true,
});

export default function ContributorsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
