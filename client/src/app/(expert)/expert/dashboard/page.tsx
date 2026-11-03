import { ExpertOverview } from "@/modules/expert/components/overview/ExpertOverview";

export const metadata = {
  title: "Expert overview",
  description:
    "Sessions waiting for your reply, what is coming up and how your sessions are going.",
};

export default function ExpertDashboardPage() {
  return <ExpertOverview />;
}
