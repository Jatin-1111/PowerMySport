import { sendEmail, escapeHtml } from "./shared";

interface DataSourceReadyForReviewEmailOptions {
  to: string;
  name: string;
  sportSlug: string;
  targetType: "FEDERATION" | "CURATED_TOURNAMENT" | "TOURNAMENT_CALENDAR";
  reviewUrl: string;
}

const DATA_SOURCE_TARGET_LABELS: Record<string, string> = {
  FEDERATION: "Federation",
  CURATED_TOURNAMENT: "Curated Tournament",
  TOURNAMENT_CALENDAR: "Tournament Calendar",
};

export const sendDataSourceReadyForReviewEmail = async (
  options: DataSourceReadyForReviewEmailOptions
): Promise<void> => {
  const targetLabel = DATA_SOURCE_TARGET_LABELS[options.targetType] || options.targetType;
  const safeName = escapeHtml(options.name);
  const safeSportSlug = escapeHtml(options.sportSlug);
  const safeReviewUrl = escapeHtml(options.reviewUrl);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white; padding: 24px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 24px; border-radius: 0 0 10px 10px; }
    .button { display: inline-block; padding: 12px 24px; background: #0f172a; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Data Source Ready for Review</h1>
  </div>
  <div class="content">
    <p>Hi ${safeName},</p>
    <p>A new ${targetLabel} extraction for <strong>${safeSportSlug}</strong> has finished and is waiting for your review.</p>
    <p style="margin-top: 20px;"><a href="${safeReviewUrl}" class="button">Review Submission</a></p>
    <p style="margin-top: 20px;">Thanks,<br/>PowerMySport Team</p>
  </div>
</body>
</html>
  `;

  await sendEmail({
    to: options.to,
    subject: `Review needed: ${targetLabel} data source (${options.sportSlug})`,
    html,
  });
};
