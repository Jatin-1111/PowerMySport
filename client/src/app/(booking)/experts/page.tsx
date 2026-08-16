import { JsonLd } from "@/components/seo/JsonLd";
import FeatureWaitlist from "@/components/shared/FeatureWaitlist";
import { itemListJsonLd } from "@/lib/seo";
import { expertApi, type Expert } from "@/modules/expert/services/expert";
import { Users } from "lucide-react";
import { ExpertsBrowseClient } from "./ExpertsBrowseClient";

// Revalidate periodically so newly onboarded experts show up without a
// redeploy — without this, Next.js statically freezes the list at build time.
export const revalidate = 60;

export default async function ExpertsBrowsePage() {
  if (process.env.NEXT_PUBLIC_EXPERTS_IS_LIVE !== "true") {
    return (
      <FeatureWaitlist
        title="Experts."
        subtitle={
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-power-orange to-amber-500">
            Coming Soon.
          </span>
        }
        description="Our Experts platform is almost here. Get ready to connect with verified coaches and mentors."
        icon={Users}
        gradientFrom="#E97316"
        gradientTo="#F59E0B"
        shadowColorClass="shadow-power-orange/30"
        buttonColorClass="bg-power-orange"
      />
    );
  }

  let initialExperts: Expert[] = [];
  let initialError: string | null = null;
  try {
    const res = await expertApi.listExperts({ limit: 60 });
    if (res.success && res.data) initialExperts = res.data;
    else initialError = res.message || "Failed to load experts.";
  } catch {
    initialError = "Failed to load experts.";
  }

  return (
    <>
      {/* The directory's value is the list itself, and the browse UI is a
          client component that cannot put it in the initial HTML. */}
      {initialExperts.length > 0 && (
        <JsonLd
          data={itemListJsonLd({
            name: "Verified sports experts on PowerMySport",
            path: "/experts",
            description:
              "Verified coaches, mentors and sports professionals available for 1:1 guidance sessions with parents and young athletes in India.",
            items: initialExperts
              .filter((expert) => expert.name)
              .map((expert) => ({
                name: expert.name as string,
                path: `/experts/${expert.id}`,
              })),
          })}
        />
      )}
      <ExpertsBrowseClient
        initialExperts={initialExperts}
        initialError={initialError}
      />
    </>
  );
}
