import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Notifications",
  description: "Your PowerMySport community notifications.",
  path: "/notifications",
  noindex: true,
});

export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
