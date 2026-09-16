import { sendEmail, emailFrontendUrl, renderEmailShell, detailTable } from "./shared";

interface PlanCheckInEmailOptions {
  email: string;
  name: string;
  sport: string;
  title: string;
  signals: string[];
  checkInId: string;
}

export const sendPlanCheckInEmail = async (options: PlanCheckInEmailOptions): Promise<void> => {
  const checkInUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/check-in/${options.checkInId}`;

  const signalsHtml = options.signals
    .map((s) => `<li style="margin-bottom: 6px;">${s}</li>`)
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .button { display: inline-block; padding: 12px 30px; background: #ff6b35; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
    .signal-box { background: #fff; border: 1px solid #eee; padding: 15px 15px 15px 30px; border-radius: 8px; margin: 15px 0; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>How's it going with ${options.sport}?</h1>
  </div>
  <div class="content">
    <h2>Hi ${options.name},</h2>
    <p>${options.title}</p>
    <p>A quick check-in — what have you noticed?</p>
    <div class="signal-box">
      <ul>${signalsHtml}</ul>
    </div>
    <center>
      <a href="${checkInUrl}" class="button">Tell us what happened</a>
    </center>
    <p>Takes under a minute — your answer shapes what we suggest next.</p>
    <p>Best regards,<br><strong>The PowerMySport Team</strong></p>
  </div>
  <div class="footer">
    <p>This email was sent to ${options.email}</p>
    <p>© ${new Date().getFullYear()} PowerMySport. All rights reserved.</p>
  </div>
</body>
</html>
  `;

  await sendEmail({
    to: options.email,
    subject: `How's ${options.sport} going? — Quick check-in`,
    html,
  });
};

interface FriendRequestEmailOptions {
  recipientName: string;
  recipientEmail: string;
  requesterName: string;
  requesterPhotoUrl?: string | undefined;
}

export const sendFriendRequestEmail = async (options: FriendRequestEmailOptions): Promise<void> => {
  const dashboardUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard/friends`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
      color: white;
      padding: 30px;
      text-align: center;
      border-radius: 10px 10px 0 0;
    }
    .content {
      background: #f9f9f9;
      padding: 30px;
      border-radius: 0 0 10px 10px;
    }
    .button {
      display: inline-block;
      padding: 12px 30px;
      background: #ff6b35;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
      font-weight: bold;
    }
    .user-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      text-align: center;
      border: 2px solid #ff6b35;
    }
    .avatar {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      margin: 0 auto 15px;
      ${options.requesterPhotoUrl ? `background-image: url(${options.requesterPhotoUrl});` : "background-color: #ff6b35;"}
      background-size: cover;
      background-position: center;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 32px;
      font-weight: bold;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      color: #666;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>👥 New Friend Request!</h1>
  </div>

  <div class="content">
    <h2>Hi ${options.recipientName},</h2>

    <p><strong>${options.requesterName}</strong> wants to connect with you on PowerMySport!</p>

    <div class="user-card">
      <div class="avatar">${!options.requesterPhotoUrl ? options.requesterName.charAt(0).toUpperCase() : ""}</div>
      <h3>${options.requesterName}</h3>
      <p>Wants to be your friend</p>
    </div>

    <p>Accept the request to book together, share activities, and stay connected!</p>

    <center>
      <a href="${dashboardUrl}" class="button">
        View Friend Request
      </a>
    </center>

    <p>Best regards,<br>
    <strong>The PowerMySport Team</strong></p>
  </div>

  <div class="footer">
    <p>This email was sent to ${options.recipientEmail}</p>
    <p>© ${new Date().getFullYear()} PowerMySport. All rights reserved.</p>
  </div>
</body>
</html>
  `;

  await sendEmail({
    to: options.recipientEmail,
    subject: `${options.requesterName} wants to connect with you on PowerMySport`,
    html,
  });
};

interface FriendRequestAcceptedEmailOptions {
  requesterName: string;
  requesterEmail: string;
  acceptedByName: string;
  acceptedByPhotoUrl?: string | undefined;
}

export const sendFriendRequestAcceptedEmail = async (
  options: FriendRequestAcceptedEmailOptions
): Promise<void> => {
  const dashboardUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard/friends`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
      color: white;
      padding: 30px;
      text-align: center;
      border-radius: 10px 10px 0 0;
    }
    .content {
      background: #f9f9f9;
      padding: 30px;
      border-radius: 0 0 10px 10px;
    }
    .button {
      display: inline-block;
      padding: 12px 30px;
      background: #28a745;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
      font-weight: bold;
    }
    .user-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      text-align: center;
      border: 2px solid #28a745;
    }
    .avatar {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      margin: 0 auto 15px;
      ${options.acceptedByPhotoUrl ? `background-image: url(${options.acceptedByPhotoUrl});` : "background-color: #28a745;"}
      background-size: cover;
      background-position: center;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 32px;
      font-weight: bold;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      color: #666;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎉 Friend Request Accepted!</h1>
  </div>

  <div class="content">
    <h2>Great news, ${options.requesterName}!</h2>

    <p><strong>${options.acceptedByName}</strong> has accepted your friend request!</p>

    <div class="user-card">
      <div class="avatar">${!options.acceptedByPhotoUrl ? options.acceptedByName.charAt(0).toUpperCase() : ""}</div>
      <h3>${options.acceptedByName}</h3>
      <p>✓ Now friends</p>
    </div>

    <p>You can now invite ${options.acceptedByName} to group bookings and stay connected through PowerMySport!</p>

    <center>
      <a href="${dashboardUrl}" class="button">
        View Friends List
      </a>
    </center>

    <p>Best regards,<br>
    <strong>The PowerMySport Team</strong></p>
  </div>

  <div class="footer">
    <p>This email was sent to ${options.requesterEmail}</p>
    <p>© ${new Date().getFullYear()} PowerMySport. All rights reserved.</p>
  </div>
</body>
</html>
  `;

  await sendEmail({
    to: options.requesterEmail,
    subject: `${options.acceptedByName} accepted your friend request!`,
    html,
  });
};

interface ReviewReceivedOptions {
  name?: string | undefined;
  email: string;
  rating: number;
  review?: string | undefined;
  reviewerName?: string | undefined;
  targetType: "VENUE" | "Coach";
}

export const sendReviewReceivedEmail = async (options: ReviewReceivedOptions): Promise<void> => {
  const stars =
    "★".repeat(Math.max(0, Math.min(5, Math.round(options.rating)))) +
    "☆".repeat(5 - Math.max(0, Math.min(5, Math.round(options.rating))));
  const html = renderEmailShell({
    heading: "You received a new review",
    intro: `Hi ${options.name || "there"}, ${options.reviewerName || "a player"} left a review for your ${options.targetType === "Coach" ? "coaching" : "venue"}.`,
    bodyHtml:
      detailTable([["Rating", `${stars} (${options.rating}/5)`]]) +
      (options.review
        ? `<p style="margin-top:8px;"><strong>Their comment:</strong><br/>"${options.review}"</p>`
        : ""),
    ctaLabel: "View reviews",
    ctaUrl: `${emailFrontendUrl()}/${options.targetType === "Coach" ? "coach/reviews" : "venue-lister/reviews"}`,
  });
  await sendEmail({
    to: options.email,
    subject: `You received a ${options.rating}★ review on PowerMySport`,
    html,
  });
};

interface RankingDigestStanding {
  listLabel: string;
  rank: number;
  previousRank: number | null;
  totalPoints: number;
  /** A CEILING on what ageing results can cost, never a forecast. */
  atRiskNextTwelveWeeks: number | null;
  weeksSinceLastRise: number | null;
}

interface RankingDigestEmailOptions {
  email: string;
  name: string;
  asOnDate: string;
  players: Array<{
    name: string;
    regNo: string;
    sportSlug: string;
    standings: RankingDigestStanding[];
  }>;
}

/** "up 18 places to 312", or "still 312" — direction in words, not just a sign. */
const movementPhrase = (standing: RankingDigestStanding): string => {
  if (standing.previousRank === null) return `new to this list at ${standing.rank}`;
  const moved = standing.previousRank - standing.rank;
  if (moved === 0) return `still ${standing.rank}`;
  const places = Math.abs(moved) === 1 ? "place" : "places";
  return `${moved > 0 ? "up" : "down"} ${Math.abs(moved)} ${places} to ${standing.rank}`;
};

/**
 * The weekly ranking digest.
 *
 * Two rules this template exists to hold, both of which a well-meaning edit
 * would break:
 *
 *   1. **"Up to" is not padding.** Points at risk is the most that ageing
 *      results can cost, because each one that drops off is replaced by the
 *      next best result we cannot see. Tightening it to "will lose" turns a
 *      bound into a prediction, in an email to a parent about their child.
 *   2. **No child is addressed.** These go to the account holder. The player is
 *      usually a minor who never gave us an email address, and the copy is
 *      written about them rather than to them throughout.
 */
export const sendRankingDigestEmail = async (options: RankingDigestEmailOptions): Promise<void> => {
  const rows = options.players.flatMap((player) =>
    player.standings.map((standing): [string, string] => {
      const risk =
        standing.atRiskNextTwelveWeeks && standing.atRiskNextTwelveWeeks > 0
          ? ` &middot; up to ${standing.atRiskNextTwelveWeeks} points could drop off within three months`
          : "";
      return [
        `${player.name} &middot; ${standing.listLabel}`,
        `${movementPhrase(standing)} &middot; ${standing.totalPoints} points${risk}`,
      ];
    })
  );

  const idle = options.players.some((player) =>
    player.standings.some(
      (standing) =>
        (standing.weeksSinceLastRise ?? 0) >= 12 && (standing.atRiskNextTwelveWeeks ?? 0) > 0
    )
  );

  const firstPlayer = options.players[0];
  const ctaUrl = firstPlayer
    ? `${emailFrontendUrl()}/rankings/${firstPlayer.sportSlug}/players/${firstPlayer.regNo}`
    : `${emailFrontendUrl()}/rankings`;

  const html = renderEmailShell({
    heading: "This week's ranking",
    intro: `Hi ${options.name}, the list published on ${options.asOnDate} is out.`,
    bodyHtml:
      detailTable(rows) +
      (idle
        ? `<p style="color:#555;">Results stop counting a year after they were earned. Where a figure above says points could drop off, that is the most it can cost if nothing newer replaces them, not a forecast.</p>`
        : ""),
    ctaLabel: "See the full history",
    ctaUrl,
  });

  await sendEmail({
    to: options.email,
    subject: `Ranking update &middot; ${options.asOnDate}`.replace("&middot;", "-"),
    html,
  });
};
