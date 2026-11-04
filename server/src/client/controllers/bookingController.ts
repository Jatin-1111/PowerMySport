// This file is a barrel re-export. The implementation was split (2026-09) out
// of a single ~1780-line module into src/client/controllers/bookingController/ —
// one file per concern (queries, invoice, availability, lifecycle, payment,
// groupBooking) — to keep it reviewable. Every export below previously lived
// directly in this file; import paths for consumers are unchanged.

export * from "./bookingController/queries";
export * from "./bookingController/invoice";
export * from "./bookingController/availability";
export * from "./bookingController/lifecycle";
export * from "./bookingController/payment";
export * from "./bookingController/groupBooking";
