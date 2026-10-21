import { Request, Response } from "express";
import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import {
  generateYouthSportsGuidance,
  guidanceRequestSchema,
  diagnosisRequestSchema,
  generateGuidanceDiagnosis,
} from "../../shared/services/guidanceAiService";
import { GuidanceSubmission } from "../models/GuidanceSubmission";
import { AnalyticsEvent } from "../../admin/models/AnalyticsEvent";
import { PlanCheckInService } from "../../shared/services/PlanCheckInService";
import { isSupportedSport, SUPPORTED_SPORTS } from "../../shared/constants/supportedSports";
import { log as __rootLog } from "../../utils/logger";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";
const log = __rootLog.child("guidance");

// ─── Rule-based burnout risk — zero AI cost ───────────────────────────────────

const BURNOUT_THRESHOLDS: Array<{
  maxAge: number;
  medium: number;
  high: number;
}> = [
  { maxAge: 7, medium: 5, high: 8 },
  { maxAge: 9, medium: 8, high: 12 },
  { maxAge: 11, medium: 10, high: 15 },
  { maxAge: 13, medium: 14, high: 20 },
  { maxAge: 15, medium: 18, high: 25 },
  { maxAge: 21, medium: 22, high: 30 },
];

function calculateBurnoutRisk(age: number, weeklyHours: number) {
  const bracket =
    BURNOUT_THRESHOLDS.find((t) => age <= t.maxAge) ??
    BURNOUT_THRESHOLDS[BURNOUT_THRESHOLDS.length - 1]!;

  if (weeklyHours >= bracket.high) {
    return {
      level: "high" as const,
      message: `${weeklyHours} hours/week is very high for a ${age}-year-old. Research shows this significantly raises the risk of burnout, overuse injuries, and early sport dropout.`,
      recommendations: [
        "Cap structured sport at 3–4 days/week with a certified coach",
        "Ensure at least 2 full rest days with zero sport activity",
        "Replace 20–30% of training with unstructured free play the child controls",
        "Watch for: loss of enthusiasm, persistent fatigue, unexplained pain, sleep problems",
        "Consult a sports physiotherapist to review the current training load",
      ],
    };
  }

  if (weeklyHours >= bracket.medium) {
    return {
      level: "medium" as const,
      message: `${weeklyHours} hours/week is on the higher end for a ${age}-year-old. Monitor closely for fatigue and enjoyment levels.`,
      recommendations: [
        "Ensure at least 1–2 complete rest days per week",
        "Balance structured training with free, child-directed play",
        "Do a weekly check-in: ask your child if they're enjoying training, not just performing",
      ],
    };
  }

  return {
    level: "low" as const,
    message: `${weeklyHours} hours/week is age-appropriate for a ${age}-year-old — a healthy foundation.`,
    recommendations: [],
  };
}

export const submitGuidance = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = guidanceRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid guidance payload",
      issues: parsed.error.flatten(),
    });
    return;
  }

  const requestedSport = parsed.data.sport?.trim();
  if (requestedSport && !isSupportedSport(requestedSport)) {
    AnalyticsEvent.create({
      eventName: "unsupported_sport_search",
      metadata: { sport: requestedSport, source: "guidance" },
      source: "WEB",
      ...(req.user ? { userId: req.user.id } : {}),
    }).catch(() => {});

    res.status(200).json({
      success: false,
      status: "not_supported",
      sport: requestedSport,
      supportedSports: SUPPORTED_SPORTS,
      message: `We're building the ${requestedSport} pathway — our team is working on it! In the meantime, explore one of our 10 supported sports.`,
    });
    return;
  }

  const guidance = await generateYouthSportsGuidance(parsed.data);

  // Enrich with server-computed fields (zero AI cost)
  const burnoutRisk = calculateBurnoutRisk(
    parsed.data.child_age,
    parsed.data.weekly_time_commitment
  );
  const enrichedGuidance = { ...guidance, burnoutRisk };

  const createPayload: any = {
    request: parsed.data,
    response: enrichedGuidance,
  };
  if (req.user?.id) {
    createPayload.userId = req.user.id;
  }
  const guidanceSubmission = await GuidanceSubmission.create(createPayload);

  // Fire-and-forget — a scheduling failure shouldn't fail the guidance
  // response the parent is actively waiting on.
  PlanCheckInService.scheduleFromGuidance({
    userId: req.user?.id,
    dependentId: parsed.data.dependent_id,
    sourceId: guidanceSubmission._id.toString(),
    sport: parsed.data.sport || "General",
    response: enrichedGuidance,
  }).catch((err) => log.error("Failed to schedule plan check-in:", err));

  res.status(201).json({
    success: true,
    message: "Guidance generated and saved",
    data: {
      id: guidanceSubmission._id.toString(),
      query: guidanceSubmission.request,
      response: enrichedGuidance,
      createdAt: guidanceSubmission.createdAt,
      updatedAt: guidanceSubmission.updatedAt,
    },
  });
});

/**
 * Diagnosis-confirmation step, run before full plan generation.
 * POST /guidance/diagnose
 */
export const diagnoseGuidance = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = diagnosisRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid diagnosis payload",
      issues: parsed.error.flatten(),
    });
    return;
  }

  const diagnosis = await generateGuidanceDiagnosis(parsed.data);
  res.status(200).json({ success: true, data: diagnosis });
});

export const deleteGuidance = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError("Unauthorized", 401);
  }

  const id = req.params.id;
  if (!id || !mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid guidance id", 400);
  }

  const deleted = await GuidanceSubmission.findOneAndDelete({
    _id: id,
    userId: req.user.id,
  });

  if (!deleted) {
    throw new AppError("Guidance not found", 404);
  }

  res.status(200).json({ success: true, message: "Guidance deleted" });
});

export const getGuidanceHistory = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    // Unbounded by construction — capped defensively since this can grow
    // over an account's lifetime and nothing else limits it.
    const history = await GuidanceSubmission.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.status(200).json({
      success: true,
      data: history.map((doc) => ({
        id: doc._id.toString(),
        query: doc.request,
        response: doc.response,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      })),
    });
  }
);

// ─── Full report PDF ───────────────────────────────────────────────────────────

const collectPdfBuffer = (doc: InstanceType<typeof PDFDocument>): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    doc.on("data", (chunk: Buffer | string) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    );
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
};

const BRAND = {
  slate: "#0F172A",
  orange: "#E97316",
  line: "#E2E8F0",
  text: "#0F172A",
  muted: "#64748B",
  white: "#FFFFFF",
};

/**
 * Download the full detailed guidance report as a PDF
 * GET /guidance/:id/report/pdf
 */
export const downloadGuidanceReportPdf = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    if (!id || !mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid guidance id", 400);
    }

    const submission = await GuidanceSubmission.findById(id);
    if (!submission) {
      throw new AppError("Guidance not found", 404);
    }

    // Guest-generated submissions have no userId and are trusted by id
    // possession (same model already used to show guests their own results).
    if (submission.userId && submission.userId.toString() !== req.user?.id) {
      throw new AppError("Forbidden", 403);
    }

    const q = submission.request;
    const r = submission.response;

    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const pageLeft = doc.page.margins.left;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const bottomLimit = doc.page.height - doc.page.margins.bottom;

    const ensureSpace = (needed: number): void => {
      if (doc.y + needed > bottomLimit) doc.addPage();
    };

    const drawSectionTitle = (title: string): void => {
      ensureSpace(30);
      doc.moveDown(0.6);
      doc
        .fillColor(BRAND.orange)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(title.toUpperCase(), pageLeft, doc.y, { characterSpacing: 0.8 });
      doc.moveDown(0.25);
      doc
        .moveTo(pageLeft, doc.y)
        .lineTo(pageLeft + pageWidth, doc.y)
        .lineWidth(1)
        .stroke(BRAND.line);
      doc.moveDown(0.4);
    };

    const drawParagraph = (text: string): void => {
      const height = doc.heightOfString(text, { width: pageWidth });
      ensureSpace(height + 8);
      doc
        .fillColor(BRAND.text)
        .font("Helvetica")
        .fontSize(10)
        .text(text, pageLeft, doc.y, { width: pageWidth });
      doc.moveDown(0.4);
    };

    const drawKeyValueRow = (label: string, value: string): void => {
      const valueHeight = doc.heightOfString(value, { width: pageWidth - 140 });
      ensureSpace(valueHeight + 6);
      const rowY = doc.y;
      doc
        .fillColor(BRAND.muted)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(label, pageLeft, rowY, { width: 130 });
      doc
        .fillColor(BRAND.text)
        .font("Helvetica")
        .fontSize(10)
        .text(value, pageLeft + 140, rowY, { width: pageWidth - 140 });
      doc.y = Math.max(doc.y, rowY + valueHeight);
      doc.moveDown(0.3);
    };

    const drawSection = (title: string, drawBody: () => void): void => {
      drawSectionTitle(title);
      drawBody();
    };

    // ── Cover header ──
    const headerHeight = 96;
    const headerTop = doc.y;
    doc.save();
    doc.roundedRect(pageLeft, headerTop, pageWidth, headerHeight, 16).fill(BRAND.slate);
    doc.restore();
    doc.save();
    doc.roundedRect(pageLeft, headerTop, pageWidth, 8, 16).fill(BRAND.orange);
    doc.restore();
    doc
      .fillColor(BRAND.white)
      .font("Helvetica-Bold")
      .fontSize(22)
      .text("PowerMySport", pageLeft + 20, headerTop + 20);
    doc
      .fillColor("#E2E8F0")
      .font("Helvetica")
      .fontSize(10)
      .text("AI Sports Guidance — Full Report", pageLeft + 20, headerTop + 50);
    doc
      .fillColor("#CBD5E1")
      .font("Helvetica")
      .fontSize(8)
      .text(
        `Generated ${new Date(submission.createdAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" })} · Report ID ${submission._id.toString()}`,
        pageLeft + 20,
        headerTop + 68
      );
    doc.y = headerTop + headerHeight + 12;

    // ── Profile & Goal ──
    drawSection("Profile & Goal", () => {
      drawKeyValueRow(
        "Child",
        `Age ${q.child_age} · ${q.child_gender === "male" ? "Boy" : "Girl"}`
      );
      drawKeyValueRow("Sport", q.sport?.trim() || "Not specified — see recommended sports below");
      drawKeyValueRow("Objective", q.primary_objective);
      if (q.location) drawKeyValueRow("Location", q.location);
      doc.moveDown(0.2);
      drawParagraph(r.profileAnalysis);
      if (r.goalAssessment) {
        doc.moveDown(0.2);
        drawKeyValueRow("Goal", r.goalAssessment.statedGoal);
        drawKeyValueRow("Verdict", r.goalAssessment.verdict);
        drawParagraph(r.goalAssessment.rationale);
        drawParagraph(`Benchmark: ${r.goalAssessment.benchmark}`);
      }
    });

    // ── Weekly Blueprint ──
    drawSection("Weekly Blueprint", () => {
      drawKeyValueRow("Training", r.weeklyBlueprint.trainingHours);
      drawKeyValueRow("Free play", r.weeklyBlueprint.freePlayHours);
      drawKeyValueRow("Rest", r.weeklyBlueprint.restDays);
    });

    // ── Full Journey Roadmap ──
    if (r.journeyPhases && r.journeyPhases.length > 0) {
      drawSection("Full Journey Roadmap", () => {
        r.journeyPhases!.forEach((phase, i) => {
          ensureSpace(60);
          doc
            .fillColor(BRAND.text)
            .font("Helvetica-Bold")
            .fontSize(11)
            .text(`${i + 1}. ${phase.title} (${phase.timeframe})`, pageLeft, doc.y, {
              width: pageWidth,
            });
          doc.moveDown(0.15);
          drawParagraph(phase.focus);
          phase.milestones.forEach((m) => {
            const bulletHeight = doc.heightOfString(m, {
              width: pageWidth - 16,
            });
            ensureSpace(bulletHeight + 4);
            doc
              .fillColor(BRAND.text)
              .font("Helvetica")
              .fontSize(9)
              .text(`• ${m}`, pageLeft + 8, doc.y, { width: pageWidth - 16 });
            doc.moveDown(0.15);
          });
          doc.moveDown(0.1);
          drawKeyValueRow("Outcome", phase.outcome);
          if (phase.estimatedCost) drawKeyValueRow("Est. cost", phase.estimatedCost);
          doc.moveDown(0.3);
        });
      });
    }

    // ── Week-by-Week Plan (short-horizon requests) ──
    if (r.shortTermPlan && r.shortTermPlan.weeks?.length > 0) {
      const plan = r.shortTermPlan;
      drawSection(`Your ${plan.durationWeeks}-Week Plan`, () => {
        plan.weeks.forEach((week) => {
          ensureSpace(50);
          doc
            .fillColor(BRAND.text)
            .font("Helvetica-Bold")
            .fontSize(11)
            .text(`${week.label} — ${week.focus}`, pageLeft, doc.y, {
              width: pageWidth,
            });
          doc.moveDown(0.15);
          week.sessions.forEach((session) => {
            // New submissions store structured {name, minutes, how, doneRight}
            // sessions; older ones store a single pre-formatted string.
            const s =
              typeof session === "string"
                ? session
                : `${session.name}${session.minutes ? ` (${session.minutes} mins)` : ""}: ${session.how}${session.doneRight ? ` Done right: ${session.doneRight}` : ""}`;
            const bulletHeight = doc.heightOfString(s, {
              width: pageWidth - 16,
            });
            ensureSpace(bulletHeight + 4);
            doc
              .fillColor(BRAND.text)
              .font("Helvetica")
              .fontSize(9)
              .text(`• ${s}`, pageLeft + 8, doc.y, { width: pageWidth - 16 });
            doc.moveDown(0.15);
          });
          doc.moveDown(0.3);
        });
        if (plan.successCheck) {
          drawKeyValueRow("Success check", plan.successCheck);
        }
      });
    }

    // ── Investment ──
    if (r.costBreakdown) {
      drawSection("Investment", () => {
        drawKeyValueRow("Monthly coaching", r.costBreakdown!.monthlyCoaching);
        drawKeyValueRow("Equipment", r.costBreakdown!.equipment);
        drawKeyValueRow("Tournaments", r.costBreakdown!.tournaments);
      });
    }

    // ── Ideal Coaching Style ──
    drawSection("Ideal Coaching Style", () => {
      drawParagraph(r.idealCoachingStyle);
    });

    // ── Mental Skills Roadmap ──
    if (r.mentalSkillsRoadmap) {
      drawSection("Mental Skills Roadmap", () => {
        drawKeyValueRow("Focus now", r.mentalSkillsRoadmap!.currentFocus);
        r.mentalSkillsRoadmap!.skills.forEach((s) => {
          drawKeyValueRow(s.skill, s.howToDevelop);
        });
      });
    }

    // ── Talent Identifiers ──
    if (r.talentIdentifiers && r.talentIdentifiers.length > 0) {
      drawSection("Talent Identifiers", () => {
        r.talentIdentifiers!.forEach((t) => {
          const h = doc.heightOfString(t, { width: pageWidth - 16 });
          ensureSpace(h + 4);
          doc
            .fillColor(BRAND.text)
            .font("Helvetica")
            .fontSize(9)
            .text(`• ${t}`, pageLeft + 8, doc.y, { width: pageWidth - 16 });
          doc.moveDown(0.15);
        });
      });
    }

    // ── Multi-Sport Advisory ──
    if (r.multiSportAdvisory) {
      drawSection("Multi-Sport Advisory", () => {
        drawParagraph(r.multiSportAdvisory!);
      });
    }

    // ── Recommended Sports ──
    if (r.recommendedSports && r.recommendedSports.length > 0) {
      drawSection("Recommended Sports", () => {
        drawParagraph(r.recommendedSports!.join(", "));
      });
    }

    // ── Burnout Risk ──
    if (r.burnoutRisk) {
      drawSection("Burnout Risk", () => {
        drawKeyValueRow("Level", r.burnoutRisk!.level.toUpperCase());
        drawParagraph(r.burnoutRisk!.message);
        r.burnoutRisk!.recommendations.forEach((rec) => {
          const h = doc.heightOfString(rec, { width: pageWidth - 16 });
          ensureSpace(h + 4);
          doc
            .fillColor(BRAND.text)
            .font("Helvetica")
            .fontSize(9)
            .text(`• ${rec}`, pageLeft + 8, doc.y, { width: pageWidth - 16 });
          doc.moveDown(0.15);
        });
      });
    }

    // ── Footer ──
    ensureSpace(40);
    doc.moveDown(0.6);
    doc
      .fillColor(BRAND.muted)
      .font("Helvetica")
      .fontSize(8)
      .text(
        "AI-generated guidance — verify with a coach or academy before acting on this plan.",
        pageLeft,
        doc.y,
        { width: pageWidth }
      );

    const pdfBuffer = await collectPdfBuffer(doc);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="guidance-report-${submission._id.toString()}.pdf"`
    );
    res.status(200).send(pdfBuffer);
  }
);

const WHATSAPP_TEAM_NUMBER = "918968582443";

/**
 * Build the WhatsApp message server-side and redirect — keeps the child's
 * details (age, gender, level, the parent's own question) out of any
 * client-rendered URL, so it can't be captured by browser history, outbound
 * link click-tracking, or DOM-scraping analytics.
 * GET /guidance/:id/whatsapp
 */
export const redirectToWhatsApp = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    if (!id || !mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid guidance id", 400);
    }

    const submission = await GuidanceSubmission.findById(id).lean();
    if (!submission) {
      throw new AppError("Guidance not found", 404);
    }

    // Same trust model as the PDF download: guest-generated submissions are
    // trusted by id possession, ownership is only enforced when a userId exists.
    if (submission.userId && submission.userId.toString() !== req.user?.id) {
      throw new AppError("Forbidden", 403);
    }

    const q = submission.request;
    const lines = [
      `Hi! I used PowerMySport's guidance tool for my child. Here are their details:`,
      `• Sport: ${q.sport}`,
      `• Age: ${q.child_age} (${q.child_gender})`,
      `• Level: ${q.current_fitness_level}`,
      `• Time: ${q.weekly_time_commitment} hrs/week`,
      ``,
      `My question: ${q.parent_specific_question}`,
      ``,
      `I'd love personalised support based on the plan.`,
    ];
    const waUrl = `https://wa.me/${WHATSAPP_TEAM_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;

    res.redirect(302, waUrl);
  }
);
