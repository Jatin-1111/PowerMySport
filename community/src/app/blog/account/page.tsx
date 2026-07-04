import MyAccountClient from "@/modules/community/components/blog/MyAccountClient";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "My Writer Account",
  description: "Manage your writer profile, blogs, and account settings.",
  path: "/blog/account",
  noindex: true,
});

export default function BlogAccountPage() {
  return <MyAccountClient />;
}
