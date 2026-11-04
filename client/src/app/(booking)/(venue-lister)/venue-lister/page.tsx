import { VenueOverview } from "@/modules/venue/components/overview/VenueOverview";

export const metadata = {
  title: "Venue overview",
  description: "Booking requests, upcoming bookings and how your venues are doing.",
};

export default function VenueListerDashboardPage() {
  return <VenueOverview />;
}
