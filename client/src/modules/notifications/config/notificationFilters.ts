export type FilterType =
  "all" | "unread" | "social" | "booking" | "payment" | "review" | "admin" | "community" | "plan";

export const filterOptions: { value: FilterType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "social", label: "Friends" },
  { value: "booking", label: "Bookings" },
  { value: "payment", label: "Payments" },
  { value: "review", label: "Reviews" },
  { value: "community", label: "Community" },
  { value: "plan", label: "Check-ins" },
  { value: "admin", label: "Admin" },
];
