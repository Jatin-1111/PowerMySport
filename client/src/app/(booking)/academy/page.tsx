import { AcademyOverview } from "@/modules/academy/components/AcademyOverview";

export const metadata = {
  title: "Academy overview",
  description: "Where your academy stands, and how it is doing, on PowerMySport.",
};

export default function AcademyDashboardPage() {
  return <AcademyOverview />;
}
