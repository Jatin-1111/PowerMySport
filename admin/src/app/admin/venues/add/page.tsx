import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AddVenueForm } from "@/modules/admin/components/AddVenueForm";

export const metadata = {
  title: "Add Venue - PowerMySport Admin",
  description: "Add a new venue to the platform",
};

export default function AdminAddVenuePage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader title="Add Venue" subtitle="Create a new venue directly in the system" />
      <AddVenueForm />
    </div>
  );
}
