import { Request, Response } from "express";
import { AnalyticsEvent } from "../../models/AnalyticsEvent";
import { buildDaySeries } from "./shared";

// ─── Guest (anonymous visitor) analytics ──────────────────────────────────────

// Only events carrying a guestId — i.e. activity from not-signed-in visitors.
const GUEST_EVENT_MATCH = { guestId: { $exists: true, $nin: [null, ""] } };

/**
 * Public, unauthenticated ingest for anonymous visitor activity.
 *
 * Privacy: we ONLY persist what the schema allows — a random client-generated
 * guestId plus event names/paths/metadata. No IP, no headers, no personal data
 * is stored here.
 */
export const trackGuestEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const { guestId, events } = req.body as {
      guestId: string;
      events: Array<{
        eventName: string;
        entityType?: string;
        entityId?: string;
        metadata?: Record<string, unknown>;
      }>;
    };

    const docs = events.map((event) => ({
      guestId,
      eventName: event.eventName,
      ...(event.entityType ? { entityType: event.entityType } : {}),
      ...(event.entityId ? { entityId: event.entityId } : {}),
      ...(event.metadata ? { metadata: event.metadata } : {}),
      source: "WEB" as const,
    }));

    await AnalyticsEvent.insertMany(docs, { ordered: false });

    res.status(201).json({
      success: true,
      message: "Guest events tracked",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to track guest events",
    });
  }
};

export const getGuestActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 30));
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const match = { ...GUEST_EVENT_MATCH, createdAt: { $gte: start } };

    const [totalsAgg, topPages, topEvents, dailyAgg, engagementAgg] = await Promise.all([
      AnalyticsEvent.aggregate<{
        events: number;
        uniqueGuests: number;
        pageViews: number;
      }>([
        { $match: match },
        {
          $group: {
            _id: null,
            events: { $sum: 1 },
            guests: { $addToSet: "$guestId" },
            pageViews: {
              $sum: { $cond: [{ $eq: ["$eventName", "page_view"] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            _id: 0,
            events: 1,
            pageViews: 1,
            uniqueGuests: { $size: "$guests" },
          },
        },
      ]),
      AnalyticsEvent.aggregate<{
        path: string;
        views: number;
        uniqueGuests: number;
      }>([
        { $match: { ...match, eventName: "page_view" } },
        {
          $group: {
            _id: "$entityId",
            views: { $sum: 1 },
            guests: { $addToSet: "$guestId" },
          },
        },
        {
          $project: {
            _id: 0,
            path: { $ifNull: ["$_id", "(unknown)"] },
            views: 1,
            uniqueGuests: { $size: "$guests" },
          },
        },
        { $sort: { views: -1 } },
        { $limit: 20 },
      ]),
      AnalyticsEvent.aggregate<{
        eventName: string;
        count: number;
        uniqueGuests: number;
      }>([
        { $match: match },
        {
          $group: {
            _id: "$eventName",
            count: { $sum: 1 },
            guests: { $addToSet: "$guestId" },
          },
        },
        {
          $project: {
            _id: 0,
            eventName: "$_id",
            count: 1,
            uniqueGuests: { $size: "$guests" },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
      AnalyticsEvent.aggregate<{
        day: string;
        views: number;
        uniqueGuests: number;
      }>([
        { $match: { ...match, eventName: "page_view" } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            views: { $sum: 1 },
            guests: { $addToSet: "$guestId" },
          },
        },
        {
          $project: {
            _id: 0,
            day: "$_id",
            views: 1,
            uniqueGuests: { $size: "$guests" },
          },
        },
        { $sort: { day: 1 } },
      ]),
      AnalyticsEvent.aggregate<{ avgScroll: number; avgTime: number }>([
        { $match: { ...match, eventName: "page_exit" } },
        {
          $group: {
            _id: null,
            avgScroll: { $avg: "$metadata.scrollDepthPct" },
            avgTime: { $avg: "$metadata.durationMs" },
          },
        },
      ]),
    ]);

    const totals = totalsAgg[0] ?? {
      events: 0,
      uniqueGuests: 0,
      pageViews: 0,
    };
    const engagement = engagementAgg[0] ?? { avgScroll: 0, avgTime: 0 };

    const daySeries = buildDaySeries(days);
    const dayMap = new Map(dailyAgg.map((row) => [row.day, row]));
    const daily = daySeries.map((point) => {
      const row = dayMap.get(point.key);
      return {
        label: point.label,
        views: row?.views ?? 0,
        uniqueGuests: row?.uniqueGuests ?? 0,
      };
    });

    res.status(200).json({
      success: true,
      message: "Guest activity retrieved",
      data: {
        days,
        totals: {
          events: totals.events,
          uniqueGuests: totals.uniqueGuests,
          pageViews: totals.pageViews,
          avgScrollPct: Math.round(engagement.avgScroll ?? 0),
          avgTimeOnPageSec: Math.round((engagement.avgTime ?? 0) / 1000),
        },
        topPages,
        topEvents,
        daily,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to retrieve guest activity",
    });
  }
};

/**
 * Permanently delete every analytics event. Destructive and irreversible —
 * gated behind admin auth and a confirmation step in the admin UI.
 */
export const clearAnalyticsData = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await AnalyticsEvent.deleteMany({});
    res.status(200).json({
      success: true,
      message: "Analytics data cleared",
      data: { deletedCount: result.deletedCount ?? 0 },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to clear analytics data",
    });
  }
};
