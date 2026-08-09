import { Request, Response } from "express";
import { RankingEntry } from "../models/RankingEntry";
import { RankingSnapshot } from "../models/RankingSnapshot";
import { AitaRankingIngestService } from "../services/aita/AitaRankingIngestService";
import { LIVE_COMBOS } from "../services/aita/types";

/**
 * Public read API for the ranking mirror.
 *
 * ── The rule this file exists to hold ────────────────────────────────────────
 * No endpoint here returns a date of birth. `dob` is `select: false` on the
 * model, so it is excluded unless a query names it, and every projection below
 * is also written out explicitly — belt and braces, because the data is
 * children's and the cost of getting it wrong is not a bug report.
 *
 * `birthYear` is the public-safe derivative and is what the payloads carry. It
 * is already implied by the age category, so it adds context without adding
 * identifiability.
 */

/** Fields safe to send to a browser. Deliberately enumerated, not `-dob`. */
const PUBLIC_ENTRY_FIELDS =
  "rank regNo givenName familyName fullName birthYear state stateCode " +
  "points totalPoints category subcategory asOnDate";

const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 50;

const fail = (res: Response, error: unknown, code = 400) =>
  res.status(code).json({
    success: false,
    message: error instanceof Error ? error.message : "Request failed",
  });

/** Mongo treats a raw string as a pattern; a name with "(" would 500 without this. */
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * GET /api/rankings
 *   ?category=Boys&subcategory=U-14   (required pair)
 *   &state=Maharashtra&search=aarav&date=2026-07-27&page=1&limit=50
 *
 * Defaults to the current list. `date` pins it to a historical snapshot, which
 * is the query the source itself can only answer by making you download a PDF.
 */
/**
 * Which sport's lists a request is about. Defaults to tennis so every existing
 * caller keeps working unchanged — the documents have carried `sportSlug` since
 * the mirror was built, but nothing sent it until the URLs grew a sport segment.
 */
const sportOf = (req: Request): string =>
  String(req.query.sport ?? "tennis").trim().toLowerCase() || "tennis";

export const listRankings = async (req: Request, res: Response): Promise<void> => {
  try {
    const sportSlug = sportOf(req);
    const category = String(req.query.category ?? "").trim();
    const subcategory = String(req.query.subcategory ?? "").trim();
    if (!category || !subcategory) {
      res.status(400).json({
        success: false,
        message: "category and subcategory are both required.",
      });
      return;
    }

    const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number.parseInt(String(req.query.limit ?? "") , 10) || DEFAULT_PAGE_SIZE),
    );

    const filter: Record<string, unknown> = { sportSlug, category, subcategory };

    const date = String(req.query.date ?? "").trim();
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({ success: false, message: "date must be YYYY-MM-DD." });
        return;
      }
      filter.asOnDate = new Date(date);
    } else {
      filter.isLatest = true;
    }

    const state = String(req.query.state ?? "").trim();
    if (state) filter.state = state;

    const search = String(req.query.search ?? "").trim();
    if (search) {
      // Anchored so the nameSearch index is usable. Matches on either name part
      // because "Given Family" order is not what a parent types half the time.
      const pattern = escapeRegex(search.toLowerCase());
      filter.$or = [
        { nameSearch: { $regex: `^${pattern}` } },
        { nameSearch: { $regex: `\\s${pattern}` } },
        { regNo: search },
      ];
    }

    const [entries, total, snapshot] = await Promise.all([
      RankingEntry.find(filter)
        .sort({ rank: 1, totalPoints: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select(PUBLIC_ENTRY_FIELDS)
        .lean(),
      RankingEntry.countDocuments(filter),
      RankingSnapshot.findOne({
        sportSlug,
        category,
        subcategory,
        status: "published",
        ...(date ? { asOnDate: new Date(date) } : { isLatestForCombo: true }),
      })
        .select("asOnDate columns rowCount sourceUrl publishedAt")
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        entries,
        // The source page this list came from, so a parent can check us against
        // AITA rather than taking our word for it.
        snapshot: snapshot ?? null,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    fail(res, err, 500);
  }
};

/**
 * GET /api/rankings/meta
 * Which combos exist, what each one's current list is dated, and which states
 * appear in it — everything a filter UI needs in one call.
 */
export const getRankingMeta = async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshots = await RankingSnapshot.find({
      sportSlug: sportOf(req),
      status: "published",
      isLatestForCombo: true,
    })
      .select("category subcategory asOnDate rowCount columns")
      .lean();

    const combos = LIVE_COMBOS.map(({ category, subcategory }) => {
      const snapshot = snapshots.find(
        (s) => s.category === category && s.subcategory === subcategory,
      );
      return {
        category,
        subcategory,
        asOnDate: snapshot?.asOnDate ?? null,
        rowCount: snapshot?.rowCount ?? 0,
        columns: snapshot?.columns ?? [],
        available: Boolean(snapshot),
      };
    });

    const states = await RankingEntry.distinct("state", { isLatest: true });

    res.json({
      success: true,
      data: {
        combos,
        states: (states as string[]).filter(Boolean).sort(),
        source: {
          federation: "All India Tennis Association",
          acronym: "AITA",
          url: "https://aitatennis.com/playerranking/",
        },
      },
    });
  } catch (err) {
    fail(res, err, 500);
  }
};

/**
 * GET /api/rankings/dates?category=Boys&subcategory=U-14
 *
 * Every as-on date we hold for a combo, newest first — what backs the "view an
 * earlier week" control. Deliberately its own endpoint rather than a field on
 * /meta: /meta is fetched on every hub render and would otherwise carry twelve
 * lists of up to 250 dates each for a control most visitors never touch.
 */
export const listRankingDates = async (req: Request, res: Response): Promise<void> => {
  try {
    const category = String(req.query.category ?? "").trim();
    const subcategory = String(req.query.subcategory ?? "").trim();
    if (!category || !subcategory) {
      res.status(400).json({
        success: false,
        message: "category and subcategory are both required.",
      });
      return;
    }

    const snapshots = await RankingSnapshot.find({
      sportSlug: sportOf(req),
      category,
      subcategory,
      status: "published",
    })
      .sort({ asOnDate: -1 })
      .select("asOnDate rowCount isLatestForCombo")
      .lean();

    res.json({
      success: true,
      data: snapshots.map((s) => ({
        asOnDate: s.asOnDate,
        rowCount: s.rowCount ?? 0,
        isLatest: Boolean(s.isLatestForCombo),
      })),
    });
  } catch (err) {
    fail(res, err, 500);
  }
};

/**
 * GET /api/rankings/players/:regNo
 *
 * A player's current standing plus their rank and points over every snapshot we
 * hold — the trajectory view, which is the whole reason for keeping history
 * rather than only mirroring the current list.
 *
 * Note for whoever builds the UI on top of this: a per-player page for a minor
 * is the surface that needs a deliberate indexing decision (see the DPDP note
 * on the RankingEntry model). The API is safe; a crawlable page keyed on a
 * child's name is a separate call that has not been made.
 */
export const getPlayerRankingHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const regNo = String(req.params.regNo ?? "").trim();
    if (!/^\d{4,8}$/.test(regNo)) {
      res.status(400).json({ success: false, message: "Invalid registration number." });
      return;
    }

    const sportSlug = sportOf(req);
    const current = await RankingEntry.find({ sportSlug, regNo, isLatest: true })
      .select(PUBLIC_ENTRY_FIELDS)
      .lean();

    if (current.length === 0) {
      const everRanked = await RankingEntry.exists({ sportSlug, regNo });
      if (!everRanked) {
        res.status(404).json({ success: false, message: "Player not found." });
        return;
      }
    }

    // Capped: a player with five years of weekly history across four combos
    // would otherwise return well over a thousand points.
    const history = await RankingEntry.find({ sportSlug, regNo })
      .sort({ asOnDate: -1 })
      .limit(600)
      .select("category subcategory asOnDate rank totalPoints")
      .lean();

    const profile = current[0] ?? null;
    res.json({
      success: true,
      data: {
        player: profile
          ? {
              regNo,
              fullName: profile.fullName,
              givenName: profile.givenName,
              familyName: profile.familyName,
              birthYear: profile.birthYear ?? null,
              state: profile.state ?? null,
            }
          : { regNo },
        current,
        history,
      },
    });
  } catch (err) {
    fail(res, err, 500);
  }
};

/**
 * GET /api/rankings/health
 * Staleness and quarantine counts. Public because it says nothing a ranking
 * page does not already, and because "how fresh is this?" is a fair question.
 */
export const getRankingHealth = async (_req: Request, res: Response): Promise<void> => {
  try {
    const health = await new AitaRankingIngestService().getHealth();
    res.json({ success: true, data: health });
  } catch (err) {
    fail(res, err, 500);
  }
};
