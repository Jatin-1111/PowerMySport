import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "My Reports",
  description: "Track the moderation status of reports you submitted.",
  path: "/reports",
  noindex: true,
});

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
