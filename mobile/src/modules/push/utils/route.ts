import type { Href } from "expo-router";

/**
 * Which screen a tapped notification opens. The server sends only the type and the first thing the
 * message is about (see phonePushData in ScheduledNotificationService), so anything missing falls
 * back to the inbox, where the full message is.
 */
export function routeForNotification(data: Record<string, unknown> | undefined): Href {
  const type = typeof data?.type === "string" ? data.type : "";
  const regNo = typeof data?.regNo === "string" && /^\d{4,8}$/.test(data.regNo) ? data.regNo : null;
  const slug =
    typeof data?.slug === "string" && /^[a-z0-9-]{1,120}$/.test(data.slug) ? data.slug : null;

  if (type === "RANKING_DIGEST" && regNo) {
    return { pathname: "/rankings/player/[regNo]", params: { regNo } };
  }
  if (type === "OPPORTUNITY_ALERT") {
    return slug ? { pathname: "/opportunities/[slug]", params: { slug } } : "/opportunities";
  }
  if (type === "PLAN_CHECKIN") return "/planner";
  return "/notifications";
}
