import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Privacy Settings",
  description:
    "Control who can message you, read receipts, and last-seen visibility in the PowerMySport community.",
  path: "/privacy",
  noindex: true,
});

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
