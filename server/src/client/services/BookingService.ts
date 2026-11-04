// This file is a barrel re-export. The implementation was split (2026-09) out
// of a single ~4000-line module into src/client/services/bookingService/ —
// one file per concern (availability, creation, queries, lifecycle,
// notifications, groupBooking, maintenance) — to keep it reviewable. Every
// export below previously lived directly in this file; import paths for
// consumers are unchanged.

export * from "./bookingService/shared";
export * from "./bookingService/availability";
export * from "./bookingService/creation";
export * from "./bookingService/queries";
export * from "./bookingService/notifications";
export * from "./bookingService/lifecycle";
export * from "./bookingService/groupBooking";
export * from "./bookingService/maintenance";
