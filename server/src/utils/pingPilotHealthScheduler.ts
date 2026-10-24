import cron, { ScheduledTask } from "node-cron";

import { bootFact } from "./boot";
import { log as __rootLog } from "./logger";

const log = __rootLog.child("pingPilotHealth");

/**
 * Hits the ping-pilott backend's /health every 5 minutes (keeps the Render
 * instance awake). Runs only on the deployed server, or when
 * `PING_PILOT_HEALTH_CRON=on` asks for it, so local boots don't ping it.
 * `PING_PILOT_HEALTH_CRON_DISABLED=true` turns it off even then.
 */
const cronExpression = process.env.PING_PILOT_HEALTH_CRON_EXPR || "*/5 * * * *";
const healthUrl =
  process.env.PING_PILOT_HEALTH_URL || "https://ping-pilott-backend.onrender.com/health";
const timeoutMs = 30_000;

let isRunning = false;

export function initializePingPilotHealthScheduler(): ScheduledTask | null {
  const wanted =
    process.env.NODE_ENV === "production" || process.env.PING_PILOT_HEALTH_CRON === "on";
  if (!wanted || process.env.PING_PILOT_HEALTH_CRON_DISABLED === "true") {
    bootFact("jobs", "ping-pilot-health off");
    return null;
  }

  const job = cron.schedule(cronExpression, async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      const res = await fetch(healthUrl, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) log.warn(`Health ping returned ${res.status}`);
    } catch (error) {
      log.warn("Health ping failed:", error);
    } finally {
      isRunning = false;
    }
  });

  bootFact("jobs", `ping-pilot-health ${cronExpression}`);
  return job;
}
