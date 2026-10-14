import { describe, expect, it } from "vitest";

import type { Notification } from "@/lib/api/notification";
import { getNotificationAction } from "@/modules/notifications/utils/notificationAction";

const notification = (over: Partial<Notification>): Notification => ({
  _id: "n1",
  userId: "u1",
  type: "OPPORTUNITY_ALERT",
  category: "OPPORTUNITY",
  title: "A window is closing soon",
  message: "",
  isRead: false,
  createdAt: "2026-10-14T00:00:00Z",
  ...over,
});

describe("getNotificationAction", () => {
  it("sends an opportunity alert to the first entry it is about", () => {
    const action = getNotificationAction(
      notification({
        data: {
          items: [{ path: "/scholarships/khelo-india" }, { path: "/admissions/du-sports-quota" }],
        },
      })
    );
    expect(action).toEqual({ label: "Open entry", href: "/scholarships/khelo-india" });
  });

  it("falls back to the dashboard when the alert carries no usable path", () => {
    const dashboard = { label: "Open Dashboard", href: "/dashboard" };
    expect(getNotificationAction(notification({}))).toEqual(dashboard);
    expect(getNotificationAction(notification({ data: { items: [] } }))).toEqual(dashboard);
    // A path that leaves the site is never followed.
    expect(
      getNotificationAction(notification({ data: { items: [{ path: "https://evil.example" }] } }))
    ).toEqual(dashboard);
  });

  it("still routes the other categories as before", () => {
    expect(getNotificationAction(notification({ category: "BOOKING" })).href).toBe(
      "/dashboard/my-bookings"
    );
    expect(
      getNotificationAction(notification({ category: "PLAN", data: { checkInId: "abc" } })).href
    ).toBe("/check-in/abc");
  });
});
