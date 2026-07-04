import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Following",
  description: "Groups and topics you follow in the PowerMySport community.",
  path: "/following",
  noindex: true,
});

export default function FollowingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
