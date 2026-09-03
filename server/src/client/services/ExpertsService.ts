// This file is a barrel re-export. The implementation was split (2026-09) out
// of a single ~2200-line module into src/client/services/ExpertsService/ —
// one file per concern (shared helpers, profile, discovery, sessionLifecycle,
// sessionActions, sessionQueries, webhookAndCron) — to keep it reviewable.
// Every export below previously lived directly in this file; import paths for
// consumers are unchanged.

export * from "./ExpertsService/shared";
export * from "./ExpertsService/profile";
export * from "./ExpertsService/discovery";
export * from "./ExpertsService/sessionLifecycle";
export * from "./ExpertsService/sessionActions";
export * from "./ExpertsService/sessionQueries";
export * from "./ExpertsService/webhookAndCron";
