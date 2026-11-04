import MyAccountClient from "@/modules/community/components/blog/MyAccountClient";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "My Writer Account",
  description: "Manage your writer profile, experiences, and account settings.",
  path: "/experiences/account",
  noindex: true,
});

export default function ExperienceAccountPage() {
  return <MyAccountClient />;
}
