import { ScheduledNotification } from "../models/ScheduledNotification";
import { sendEmail } from "../utils/email";

interface MonitoringStats {
  total: number;
  pending: number;
  sent: number;
  failed: number;
  cancelled: number;
  failureRate: number;
  lastProcessed: Date | null;
}

interface SchedulerHealthStatus {
  isHealthy: boolean;
  lastRun: Date | null;
  minutesSinceLastRun: number | null;
  pendingCount: number;
  overdueCount: number;
  issues: string[];
}

interface FailedReminderInfo {
  reminderId: string;
  userId: string;
  bookingId: string;
  interval: string;
  failedAt: Date;
  failureReason: string;
  retryCount: number;
}

export class ReminderMonitoringService {
  private static lastHealthCheck: Date | null = null;
  private static lastProcessingTime: Date | null = null;

  /**
   * Get comprehensive monitoring statistics
   */
  static async getMonitoringStats(): Promise<MonitoringStats> {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get counts by status for last 24 hours
    const stats = await ScheduledNotification.aggregate([
      {
        $match: {
          createdAt: { $gte: last24Hours },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const statusCounts = stats.reduce(
      (acc, stat) => {
        acc[stat._id.toLowerCase()] = stat.count;
        return acc;
      },
      { pending: 0, sent: 0, failed: 0, cancelled: 0 } as Record<
        string,
        number
      >,
    );

    const total = (Object.values(statusCounts) as number[]).reduce(
      (sum: number, count: number) => sum + count,
      0,
    );
    const failureRate =
      total > 0
        ? (statusCounts.failed / (statusCounts.sent + statusCounts.failed)) *
          100
        : 0;

    // Get last processed reminder
    const lastProcessed = await ScheduledNotification.findOne({
      status: { $in: ["SENT", "FAILED"] },
    })
      .sort({ updatedAt: -1 })
      .select("updatedAt");

    return {
      total,
      pending: statusCounts.pending,
      sent: statusCounts.sent,
      failed: statusCounts.failed,
      cancelled: statusCounts.cancelled,
      failureRate: Math.round(failureRate * 100) / 100,
      lastProcessed: lastProcessed?.updatedAt || null,
    };
  }

  /**
   * Check scheduler health status
   */
  static async checkSchedulerHealth(): Promise<SchedulerHealthStatus> {
    const now = new Date();
    const issues: string[] = [];

    // Check time since last processing
    const minutesSinceLastRun = this.lastProcessingTime
      ? Math.floor((now.getTime() - this.lastProcessingTime.getTime()) / 60000)
      : null;

    // Get pending and overdue counts
    const pendingCount = await ScheduledNotification.countDocuments({
      status: "PENDING",
    });

    const overdueCount = await ScheduledNotification.countDocuments({
      status: "PENDING",
      scheduledFor: { $lte: now },
    });

    // Determine health issues
    if (minutesSinceLastRun !== null && minutesSinceLastRun > 10) {
      issues.push(
        `Scheduler hasn't run in ${minutesSinceLastRun} minutes (expected: every 1-5 minutes)`,
      );
    }

    if (overdueCount > 50) {
      issues.push(
        `High number of overdue reminders: ${overdueCount} (may indicate processing bottleneck)`,
      );
    }

    // Check failure rate
    const stats = await this.getMonitoringStats();
    if (stats.failureRate > 10) {
      issues.push(`High failure rate: ${stats.failureRate}% (threshold: 10%)`);
    }

    const isHealthy = issues.length === 0;
    this.lastHealthCheck = now;

    return {
      isHealthy,
      lastRun: this.lastProcessingTime,
      minutesSinceLastRun,
      pendingCount,
      overdueCount,
      issues,
    };
  }

  /**
   * Record a processing run
   */
  static recordProcessingRun(): void {
    this.lastProcessingTime = new Date();
  }

  /**
   * Get failed reminders for investigation
   */
  static async getFailedReminders(
    limit: number = 50,
  ): Promise<FailedReminderInfo[]> {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const failedReminders = await ScheduledNotification.find({
      status: "FAILED",
      failedAt: { $gte: last24Hours },
    })
      .sort({ failedAt: -1 })
      .limit(limit)
      .select("userId bookingId interval failedAt failureReason retryCount");

    return failedReminders.map((reminder) => ({
      reminderId: reminder._id.toString(),
      userId: reminder.userId.toString(),
      bookingId: reminder.bookingId?.toString() || "unknown",
      interval: reminder.interval,
      failedAt: reminder.failedAt!,
      failureReason: reminder.failureReason || "Unknown error",
      retryCount: reminder.retryCount || 0,
    }));
  }

  /**
   * Send alert email to admins about critical issues
   */
  static async sendHealthAlert(
    healthStatus: SchedulerHealthStatus,
  ): Promise<void> {
    if (healthStatus.isHealthy) {
      return; // No alert needed
    }

    const adminEmail =
      process.env.ALERT_EMAIL ||
      process.env.EMAIL_USER ||
      "admin@powermysport.com";
    const appName = "PowerMySport Reminder System";

    const issuesList = healthStatus.issues
      .map((issue) => `<li style="margin:8px 0;color:#991b1b;">${issue}</li>`)
      .join("");

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .alert-box { background: #fef2f2; border: 2px solid #fecaca; padding: 15px; border-radius: 8px; margin: 15px 0; }
    .stats-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    .stats-table td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
    .stats-table td:first-child { font-weight: bold; color: #64748b; }
    .footer { margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🚨 Reminder System Health Alert</h1>
    <p>Critical issues detected that require attention</p>
  </div>
  
  <div class="content">
    <p><strong>Alert Time:</strong> ${new Date().toLocaleString("en-IN")}</p>
    
    <div class="alert-box">
      <h3 style="margin-top:0;color:#991b1b;">Issues Detected:</h3>
      <ul style="margin:10px 0;padding-left:20px;">
        ${issuesList}
      </ul>
    </div>

    <h3>System Status:</h3>
    <table class="stats-table">
      <tr>
        <td>Last Scheduler Run</td>
        <td>${healthStatus.lastRun ? healthStatus.lastRun.toLocaleString("en-IN") : "Never"}</td>
      </tr>
      <tr>
        <td>Minutes Since Last Run</td>
        <td style="color:${(healthStatus.minutesSinceLastRun || 0) > 10 ? "#dc2626" : "#16a34a"};">
          ${healthStatus.minutesSinceLastRun !== null ? `${healthStatus.minutesSinceLastRun} minutes` : "N/A"}
        </td>
      </tr>
      <tr>
        <td>Pending Reminders</td>
        <td>${healthStatus.pendingCount}</td>
      </tr>
      <tr>
        <td>Overdue Reminders</td>
        <td style="color:${healthStatus.overdueCount > 50 ? "#dc2626" : "#16a34a"};">
          ${healthStatus.overdueCount}
        </td>
      </tr>
    </table>

    <h3>Recommended Actions:</h3>
    <ul>
      <li>Check if the server is running</li>
      <li>Verify the scheduler cron job is active</li>
      <li>Check server logs for errors</li>
      <li>Review database connection status</li>
      <li>Investigate failed reminder reasons</li>
    </ul>

    <div class="footer">
      <p>This is an automated alert from ${appName}.<br/>
      Server: ${process.env.NODE_ENV || "development"}</p>
    </div>
  </div>
</body>
</html>
    `;

    try {
      await sendEmail({
        to: adminEmail,
        subject: `🚨 [ALERT] Reminder System Health Issues Detected - ${appName}`,
        html,
      });
      console.log(`📧 Health alert sent to ${adminEmail}`);
    } catch (error) {
      console.error("Failed to send health alert email:", error);
    }
  }

  /**
   * Send daily summary report
   */
  static async sendDailySummary(): Promise<void> {
    const adminEmail =
      process.env.ALERT_EMAIL ||
      process.env.EMAIL_USER ||
      "admin@powermysport.com";
    const stats = await this.getMonitoringStats();
    const healthStatus = await this.checkSchedulerHealth();
    const failedReminders = await this.getFailedReminders(10);

    const failedRemindersList =
      failedReminders.length > 0
        ? failedReminders
            .map(
              (r) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;">${r.interval}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;">${r.failedAt.toLocaleString("en-IN")}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;">${r.failureReason.substring(0, 50)}${r.failureReason.length > 50 ? "..." : ""}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;">${r.retryCount}</td>
      </tr>
    `,
            )
            .join("")
        : '<tr><td colspan="4" style="padding:15px;text-align:center;color:#64748b;">No failed reminders in the last 24 hours 🎉</td></tr>';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; color: #333; max-width: 800px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 25px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #ffffff; padding: 25px; }
    .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0; }
    .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 32px; font-weight: bold; color: #0f172a; }
    .stat-label { font-size: 13px; color: #64748b; margin-top: 5px; }
    .health-status { padding: 15px; border-radius: 8px; margin: 15px 0; }
    .health-healthy { background: #ecfdf5; border: 2px solid #a7f3d0; color: #065f46; }
    .health-unhealthy { background: #fef2f2; border: 2px solid #fecaca; color: #991b1b; }
    .table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    .table th { background: #f1f5f9; padding: 10px; text-align: left; font-size: 13px; color: #475569; border-bottom: 2px solid #cbd5e1; }
    .footer { margin-top: 25px; padding-top: 15px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div style="background:#eef2f7;padding:20px;">
    <div class="header">
      <h1 style="margin:0;">📊 Daily Reminder System Report</h1>
      <p style="margin:10px 0 0;opacity:0.9;">${new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
    </div>
    
    <div class="content">
      <h2>24-Hour Summary</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${stats.total}</div>
          <div class="stat-label">Total Reminders</div>
        </div>
        <div class="stat-card" style="${stats.sent > 0 ? "border-left:4px solid #22c55e;" : ""}">
          <div class="stat-value" style="color:#16a34a;">${stats.sent}</div>
          <div class="stat-label">Successfully Sent</div>
        </div>
        <div class="stat-card" style="${stats.failed > 0 ? "border-left:4px solid #ef4444;" : ""}">
          <div class="stat-value" style="color:#dc2626;">${stats.failed}</div>
          <div class="stat-label">Failed</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:${stats.failureRate > 10 ? "#dc2626" : "#16a34a"};">${stats.failureRate}%</div>
          <div class="stat-label">Failure Rate</div>
        </div>
      </div>

      <h2>System Health</h2>
      <div class="health-status ${healthStatus.isHealthy ? "health-healthy" : "health-unhealthy"}">
        <strong>${healthStatus.isHealthy ? "✅ System Healthy" : "⚠️ Issues Detected"}</strong>
        ${
          !healthStatus.isHealthy
            ? `<ul style="margin:10px 0 0;padding-left:20px;">${healthStatus.issues.map((issue) => `<li>${issue}</li>`).join("")}</ul>`
            : "<p style='margin:5px 0 0;'>All systems operating normally.</p>"
        }
      </div>

      <table class="table" style="margin-top:15px;font-size:13px;">
        <tr>
          <td style="padding:10px;background:#f8fafc;font-weight:bold;color:#64748b;">Pending Reminders</td>
          <td style="padding:10px;background:#f8fafc;">${healthStatus.pendingCount}</td>
        </tr>
        <tr>
          <td style="padding:10px;font-weight:bold;color:#64748b;">Overdue Reminders</td>
          <td style="padding:10px;color:${healthStatus.overdueCount > 0 ? "#dc2626" : "#16a34a"};">${healthStatus.overdueCount}</td>
        </tr>
        <tr>
          <td style="padding:10px;background:#f8fafc;font-weight:bold;color:#64748b;">Last Scheduler Run</td>
          <td style="padding:10px;background:#f8fafc;">${healthStatus.lastRun ? healthStatus.lastRun.toLocaleString("en-IN") : "N/A"}</td>
        </tr>
      </table>

      ${
        failedReminders.length > 0
          ? `
      <h2>Recent Failed Reminders (Last 10)</h2>
      <table class="table">
        <thead>
          <tr>
            <th>Interval</th>
            <th>Failed At</th>
            <th>Reason</th>
            <th style="text-align:center;">Retries</th>
          </tr>
        </thead>
        <tbody>
          ${failedRemindersList}
        </tbody>
      </table>
      `
          : ""
      }

      <div class="footer">
        <p>This is an automated daily report from PowerMySport Reminder System.<br/>
        Server: ${process.env.NODE_ENV || "development"} | Generated: ${new Date().toLocaleString("en-IN")}</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    try {
      await sendEmail({
        to: adminEmail,
        subject: `📊 Daily Reminder System Report - ${new Date().toLocaleDateString("en-IN")}`,
        html,
      });
      console.log(`📧 Daily summary sent to ${adminEmail}`);
    } catch (error) {
      console.error("Failed to send daily summary email:", error);
    }
  }

  /**
   * Retry a failed reminder
   */
  static async retryFailedReminder(
    reminderId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const reminder = await ScheduledNotification.findById(reminderId);

      if (!reminder) {
        return { success: false, message: "Reminder not found" };
      }

      if (reminder.status !== "FAILED") {
        return {
          success: false,
          message: `Reminder status is ${reminder.status}, cannot retry`,
        };
      }

      // Reset reminder to pending status and reschedule for immediate processing
      reminder.status = "PENDING";
      reminder.scheduledFor = new Date(); // Schedule for immediate processing
      if (reminder.failureReason) {
        delete (reminder as any).failureReason;
      }
      // Don't reset retry count - keep it to track total attempts

      await reminder.save();

      console.log(
        `✅ Reminder ${reminderId} reset to PENDING for retry (total attempts: ${reminder.retryCount})`,
      );

      return {
        success: true,
        message: `Reminder queued for retry (attempt ${reminder.retryCount + 1})`,
      };
    } catch (error) {
      console.error("Failed to retry reminder:", error);
      return { success: false, message: "Failed to retry reminder" };
    }
  }

  /**
   * Retry multiple failed reminders  */
  static async retryMultipleReminders(reminderIds: string[]): Promise<{
    success: boolean;
    results: { reminderId: string; success: boolean; message: string }[];
  }> {
    const results = await Promise.all(
      reminderIds.map(async (id) => {
        const result = await this.retryFailedReminder(id);
        return { reminderId: id, ...result };
      }),
    );

    const successCount = results.filter((r) => r.success).length;

    return {
      success: successCount > 0,
      results,
    };
  }

  /**
   * Check if monitoring should send an alert
   * Call this periodically (e.g., every 10 minutes)
   */
  static async performHealthCheck(): Promise<void> {
    const healthStatus = await this.checkSchedulerHealth();

    if (!healthStatus.isHealthy) {
      console.warn("⚠️ Scheduler health check failed:", healthStatus.issues);
      await this.sendHealthAlert(healthStatus);
    } else {
      console.log("✅ Scheduler health check passed");
    }
  }
}
