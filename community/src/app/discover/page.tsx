import { Metadata } from "next";
import DiscoverPageClient from "@/modules/community/components/discover/DiscoverPageClient";

export const metadata: Metadata = {
  title: "Discover - PowerMySport Community",
  description: "Discover new communities and players on PowerMySport.",
};

export default function DiscoverPage() {
  return <DiscoverPageClient />;
}
