import { ProviderFigures } from "@/modules/shared/components/dashboard/ProviderFigures";
import type { AnalyticsData, Coach, EarningsData } from "@/types";

/**
 * The coach's four figures. The rating comes from the profile, which is always
 * loaded; the client count comes from analytics and says so when it is missing.
 */
export function CoachFigures({
  earnings,
  analytics,
  analyticsFailed,
  coach,
}: {
  earnings: EarningsData;
  analytics: AnalyticsData | undefined;
  analyticsFailed: boolean;
  coach: Coach;
}) {
  return (
    <ProviderFigures
      earnings={earnings}
      people={
        analytics
          ? {
              total: analytics.overview.totalClients,
              returning: analytics.overview.returningClients,
            }
          : undefined
      }
      peopleFailed={analyticsFailed}
      peopleLabel="Clients"
      rating={coach.reviewCount > 0 ? { value: coach.rating, count: coach.reviewCount } : null}
    />
  );
}
