import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Join Group",
  description: "Join a PowerMySport community group using an invite link.",
  path: "/join",
  noindex: true,
});

export default function JoinLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
