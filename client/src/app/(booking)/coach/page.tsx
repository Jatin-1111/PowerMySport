import { CoachOverview } from "@/modules/coach/components/overview/CoachOverview";

export const metadata = {
  title: "Coach overview",
  description: "Booking requests, upcoming sessions and how your coaching is doing.",
};

export default function CoachDashboardPage() {
  return <CoachOverview />;
}
