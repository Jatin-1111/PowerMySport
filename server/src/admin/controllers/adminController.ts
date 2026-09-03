// This file is a barrel re-export. The implementation was split (2026-09) out
// of a single ~2540-line module into src/admin/controllers/adminController/ —
// one file per domain (shared helpers, auth, adminManagement, coaches,
// webhooks, safety, communityReports, refunds, disputes, venues) — to keep it
// reviewable. Every export below previously lived directly in this file;
// import paths for consumers are unchanged.

export * from "./adminController/shared";
export * from "./adminController/auth";
export * from "./adminController/adminManagement";
export * from "./adminController/coaches";
export * from "./adminController/webhooks";
export * from "./adminController/safety";
export * from "./adminController/communityReports";
export * from "./adminController/refunds";
export * from "./adminController/disputes";
export * from "./adminController/venues";
