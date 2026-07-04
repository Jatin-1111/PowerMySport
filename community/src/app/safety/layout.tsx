import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Safety Center",
  description:
    "Manage blocked users and review moderation status with the PowerMySport community safety controls.",
  path: "/safety",
  noindex: true,
});

export default function SafetyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
