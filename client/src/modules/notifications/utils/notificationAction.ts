import { getCommunityAppUrl } from "@/lib/community/url";
import type { Notification } from "@/lib/api/notification";

/** Where a notification's button goes, by what kind of notification it is. */
export const getNotificationAction = (notification: Notification) => {
  const data = (notification.data || {}) as Record<string, unknown>;
  if (notification.category === "BOOKING")
    return { label: "View Booking", href: "/dashboard/my-bookings" };
  if (notification.category === "SOCIAL")
    return { label: "View Friends", href: "/dashboard/friends" };
  if (notification.category === "PAYMENT") {
    if (typeof data.orderId === "string" && data.orderId)
      return { label: "View Order", href: `/dashboard/orders/${data.orderId}` };
    if (typeof data.bookingId === "string" && data.bookingId)
      return {
        label: "View Booking",
        href: `/dashboard/my-bookings?id=${data.bookingId}`,
      };
    return { label: "View Payments", href: "/dashboard/my-bookings" };
  }
  if (notification.category === "REVIEW")
    return { label: "View Review", href: "/dashboard/my-bookings" };
  if (notification.category === "PLAN") {
    const checkInId = typeof data.checkInId === "string" ? data.checkInId : "";
    return checkInId
      ? { label: "Open Check-in", href: `/check-in/${checkInId}` }
      : { label: "Open Dashboard", href: "/dashboard" };
  }
  if (notification.category === "COMMUNITY") {
    const postId = typeof data.postId === "string" ? data.postId : "";
    return {
      label: "Open Community",
      href: getCommunityAppUrl({ path: postId ? `q/${postId}` : "q" }),
      external: false,
    };
  }
  if (notification.category === "OPPORTUNITY") {
    // The first entry the alert is about; the others are in the message.
    const items = Array.isArray(data.items) ? (data.items as Array<{ path?: unknown }>) : [];
    const path = typeof items[0]?.path === "string" ? items[0].path : "";
    return path.startsWith("/")
      ? { label: "Open entry", href: path }
      : { label: "Open Dashboard", href: "/dashboard" };
  }
  return { label: "Open Dashboard", href: "/dashboard" };
};
