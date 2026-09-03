import { log as __rootLog } from "../../../utils/logger";

export const log = __rootLog.child("auth");

export const LEGAL_POLICY_VERSION = "2026-04";

/**
 * Grace period (in ms) between a self-service deletion request and the
 * scheduled job actually finalizing it. Overridable for testing.
 */
export const ACCOUNT_DELETION_GRACE_PERIOD_MS =
  (Number(process.env.ACCOUNT_DELETION_GRACE_PERIOD_DAYS) || 30) * 24 * 60 * 60 * 1000;
