import { Request, Response } from "express";
import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import {
  generateYouthSportsGuidance,
  guidanceRequestSchema,
  sportMatchRequestSchema,
  generateSportMatchRecommendation,
} from "../../shared/services/guidanceAiService";
import { GuidanceSubmission } from "../models/GuidanceSubmission";
import { SportPathway } from "../../shared/models/SportPathway";
import { Sport } from "../../shared/models/Sport";
import { AnalyticsEvent } from "../../admin/models/AnalyticsEvent";
import { isSupportedSport, SUPPORTED_SPORTS } from "../../shared/constants/supportedSports";

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

export const submitGuidance = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
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
      parsed.data.weekly_time_commitment,
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
  } catch (error) {
    let errorMessage =
      error instanceof Error ? error.message : "Failed to generate guidance";

    // Attempt to parse Gemini's raw JSON error array
    try {
      const parsedError = JSON.parse(errorMessage);
      if (Array.isArray(parsedError) && parsedError[0]?.error?.message) {
        errorMessage = parsedError[0].error.message;
      } else if (parsedError?.error?.message) {
        errorMessage = parsedError.error.message;
      }
    } catch {
      // Not a JSON string, ignore and use as is
    }

    const normalizedMessage = errorMessage.toLowerCase();
    const isTemporarilyUnavailable =
      normalizedMessage.includes("quota") ||
      normalizedMessage.includes("rate limit") ||
      normalizedMessage.includes("too many requests") ||
      normalizedMessage.includes("temporarily unavailable");

    res.status(isTemporarilyUnavailable ? 503 : 500).json({
      success: false,
      message: errorMessage,
    });
  }
};

export const deleteGuidance = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const id = req.params.id;
    if (!id || !mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid roadmap id" });
      return;
    }

    const deleted = await GuidanceSubmission.findOneAndDelete({
      _id: id,
      userId: req.user.id,
    });

    if (!deleted) {
      res.status(404).json({ success: false, message: "Roadmap not found" });
      return;
    }

    res.status(200).json({ success: true, message: "Roadmap deleted" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete roadmap",
    });
  }
};

export const getGuidanceHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const history = await GuidanceSubmission.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
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
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch guidance history",
    });
  }
};

// ─── Full report PDF ───────────────────────────────────────────────────────────

const collectPdfBuffer = (
  doc: InstanceType<typeof PDFDocument>,
): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    doc.on("data", (chunk: Buffer | string) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
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
export const downloadGuidanceReportPdf = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id;
    if (!id || !mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid roadmap id" });
      return;
    }

    const submission = await GuidanceSubmission.findById(id);
    if (!submission) {
      res.status(404).json({ success: false, message: "Roadmap not found" });
      return;
    }

    // Guest-generated submissions have no userId and are trusted by id
    // possession (same model already used to show guests their own results).
    if (submission.userId && submission.userId.toString() !== req.user?.id) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    const q = submission.request;
    const r = submission.response;

    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const pageLeft = doc.page.margins.left;
    const pageWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
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
    doc
      .roundedRect(pageLeft, headerTop, pageWidth, headerHeight, 16)
      .fill(BRAND.slate);
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
        headerTop + 68,
      );
    doc.y = headerTop + headerHeight + 12;

    // ── Profile & Goal ──
    drawSection("Profile & Goal", () => {
      drawKeyValueRow(
        "Child",
        `Age ${q.child_age} · ${q.child_gender === "male" ? "Boy" : "Girl"}`,
      );
      drawKeyValueRow(
        "Sport",
        q.sport?.trim() || "Not specified — see recommended sports below",
      );
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
            .text(
              `${i + 1}. ${phase.title} (${phase.timeframe})`,
              pageLeft,
              doc.y,
              { width: pageWidth },
            );
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
          if (phase.estimatedCost)
            drawKeyValueRow("Est. cost", phase.estimatedCost);
          doc.moveDown(0.3);
        });
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
        { width: pageWidth },
      );

    const pdfBuffer = await collectPdfBuffer(doc);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="guidance-report-${submission._id.toString()}.pdf"`,
    );
    res.status(200).send(pdfBuffer);
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to generate report",
    });
  }
};

const getCategoryScore = (tags: string[], attributes?: any): number => {
  if (!attributes) return 0;
  let score = 0;

  for (const tag of tags) {
    const t = tag.toLowerCase();
    if (t === "competitive" && attributes.interactionType === "head-to-head")
      score += 1;
    if (t === "social" && attributes.interactionType === "team") score += 2;
    if (t === "team-oriented" && attributes.interactionType === "team")
      score += 2;
    if (t === "shy" && attributes.interactionType === "individual") score += 2;
    if (
      t === "energetic" &&
      (attributes.demand === "power" ||
        attributes.demand === "reflex" ||
        attributes.demand === "endurance")
    )
      score += 1;
    if (
      t === "focused" &&
      (attributes.demand === "precision" || attributes.demand === "strategy")
    )
      score += 2;
    if (
      t === "patient" &&
      (attributes.demand === "strategy" ||
        attributes.demand === "precision" ||
        attributes.demand === "flexibility")
    )
      score += 1;
    if (t === "curious") score += 1; // inquisitive for anything
  }
  return score;
};

const getBudgetScore = (budget: string, costStr: string): number => {
  if (!costStr) return 0;
  const nums = costStr.replace(/,/g, "").match(/\d+/g);
  let avg = 0;
  if (nums && nums.length > 0) {
    const parsed = nums.map(Number);
    avg = parsed.reduce((a, b) => a + b, 0) / parsed.length;
  } else {
    return 0; // cannot parse
  }
  const b = budget.toLowerCase();
  if (b === "budget") {
    if (avg <= 8000) return 2;
    if (avg > 20000) return -2;
  } else if (b === "moderate") {
    if (avg >= 5000 && avg <= 30000) return 2;
  } else if (b === "premium") {
    if (avg > 15000) return 2;
  }
  return 0;
};

const getAgeScore = (age: number, rangeStr: string): number => {
  if (!rangeStr) return 0;
  const nums = rangeStr.match(/\d+/g);
  if (nums && nums.length >= 2) {
    const min = Number(nums[0]);
    const max = Number(nums[1]);
    if (age >= min && age <= max) return 2;
    if (age < min) return -1;
    if (age > max + 3) return -1;
  }
  return 0;
};

export const recommendSport = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const parsed = sportMatchRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({
          success: false,
          message: "Invalid payload",
          issues: parsed.error.flatten(),
        });
      return;
    }

    // Step A: Rule-based ranking
    const stateSlug = parsed.data.location.toLowerCase().replace(/\s+/g, "-");

    // 1. Get all verified sports (the full catalog)
    const allSports = await Sport.find({ isVerified: true }).lean();

    // 2. Fetch existing pathways for this specific state
    const existingPathways = await SportPathway.find({
      cacheKey: { $regex: new RegExp(`_${stateSlug}$`, "i") },
    }).lean();

    // 3. Create a map of existing pathways by sport slug
    const pathwayBySlug = new Map<string, any>(
      existingPathways.map((p) => [(p as any).sportSlug, p]),
    );

    if (allSports.length === 0) {
      res.status(404).json({ success: false, message: "No sports available" });
      return;
    }

    const scoredSports = allSports.map((sport) => {
      let score = 0;

      // Calculate category score (works without pathway data)
      score += getCategoryScore(parsed.data.personality_tags, sport.attributes);

      // Check if we have pathway data for this sport in this state
      const p = pathwayBySlug.get(sport.slug);
      const hasGeneratedPathway = !!p;

      let level1 = null;
      let equip1 = null;
      let overview = sport.description || "";

      if (hasGeneratedPathway) {
        level1 = p.levels && p.levels.length > 0 ? p.levels[0] : null;
        equip1 = p.equipment && p.equipment.length > 0 ? p.equipment[0] : null;
        if (p.overview) overview = p.overview;

        if (equip1 && equip1.estimatedCost) {
          score += getBudgetScore(
            parsed.data.budget_tier,
            equip1.estimatedCost,
          );
        }
        if (level1 && level1.ageRange) {
          score += getAgeScore(parsed.data.child_age, level1.ageRange);
        }
      }

      const MAX_POSSIBLE_SCORE = 10;
      const normalizedScore = Math.max(
        0,
        Math.min(100, Math.round((score / MAX_POSSIBLE_SCORE) * 100)),
      );

      return {
        sportSlug: sport.slug,
        sportName: sport.name,
        matchScore: normalizedScore,
        category: sport.category || "Other",
        sportDescription: sport.description || "",
        attributes: sport.attributes || null,
        keyFocus: level1?.keyFocus || null,
        mentalSkillsFocus: level1?.mentalSkillsFocus || null,
        levelDescription: level1?.description || null,
        talentSignals: level1?.talentSignals
          ? JSON.stringify(level1.talentSignals)
          : "None",
        equipmentCost: equip1?.estimatedCost || "Unknown",
        overview: overview,
        hasGeneratedPathway,
      };
    });

    scoredSports.sort((a, b) => b.matchScore - a.matchScore);
    const top3 = scoredSports.slice(0, 3);

    // Step B: Grounded AI Call
    const recommendationResponse = await generateSportMatchRecommendation(
      parsed.data,
      top3,
    );

    res.status(200).json({
      success: true,
      data: recommendationResponse,
    });
  } catch (error) {
    let errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to generate recommendation";
    const normalizedMessage = errorMessage.toLowerCase();
    const isTemporarilyUnavailable =
      normalizedMessage.includes("quota") ||
      normalizedMessage.includes("rate limit") ||
      normalizedMessage.includes("too many requests") ||
      normalizedMessage.includes("temporarily unavailable");

    res.status(isTemporarilyUnavailable ? 503 : 500).json({
      success: false,
      message: errorMessage,
    });
  }
};
