import { VenueBookings } from "@/modules/venue/components/bookings/VenueBookings";

export const metadata = {
  title: "Venue bookings",
  description: "Answer booking requests, check players in and see what is coming up.",
};

export default function VenueBookingsPage() {
  return <VenueBookings />;
}
