// This file is a barrel re-export. The implementation was split (2026-09) out
// of a single ~2700-line module into src/utils/email/ — one file per domain
// (shared transport/template helpers, auth, booking, social, provider,
// dataSource, shop) — to keep it reviewable. Every export below previously
// lived directly in this file; import paths for consumers are unchanged.

export * from "./email/shared";
export * from "./email/auth";
export * from "./email/booking";
export * from "./email/social";
export * from "./email/provider";
export * from "./email/dataSource";
export * from "./email/shop";
