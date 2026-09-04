import { Request, Response } from "express";
import { AnalyticsEvent } from "../../models/AnalyticsEvent";
import { FunnelSource, FUNNEL_SOURCE_SET, buildDaySeries } from "./shared";
import { asyncHandler } from "../../../middleware/asyncHandler";

export const getFunnelTrends = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const trendRows = await AnalyticsEvent.aggregate<{
    _id: { day: string; source: FunnelSource };
    count: number;
  }>([
    {
      $match: {
        createdAt: { $gte: start },
        source: { $in: Array.from(FUNNEL_SOURCE_SET) },
      },
    },
    {
      $group: {
        _id: {
          day: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
            },
          },
          source: "$source",
        },
        count: { $sum: 1 },
      },
    },
    {
      $sort: {
        "_id.day": 1,
        "_id.source": 1,
      },
    },
  ]);

  const daySeries = buildDaySeries(days);
  const dayBuckets = new Map(
    daySeries.map((item) => [item.key, { ...item, total: 0, WEB: 0, MOBILE: 0, SERVER: 0 }])
  );

  const sourceTotals: Record<FunnelSource, number> = {
    WEB: 0,
    MOBILE: 0,
    SERVER: 0,
  };

  for (const row of trendRows) {
    const bucket = dayBuckets.get(row._id.day);
    if (!bucket) continue;

    bucket[row._id.source] += row.count;
    bucket.total += row.count;
    sourceTotals[row._id.source] += row.count;
  }

  res.status(200).json({
    success: true,
    message: "Funnel trends retrieved successfully",
    data: {
      days,
      dailyActivity: Array.from(dayBuckets.values()),
      sourceBreakdown: (Object.keys(sourceTotals) as FunnelSource[]).map((source) => ({
        source,
        count: sourceTotals[source],
      })),
    },
  });
});

export const trackFunnelEvent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { eventName, entityType, entityId, metadata, source } = req.body as {
    eventName: string;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
    source?: "WEB" | "MOBILE" | "SERVER";
  };

  await AnalyticsEvent.create({
    ...(req.user?.id ? { userId: req.user.id } : {}),
    eventName,
    ...(entityType ? { entityType } : {}),
    ...(entityId ? { entityId } : {}),
    ...(metadata ? { metadata } : {}),
    source: source || "WEB",
  });

  res.status(201).json({
    success: true,
    message: "Funnel event tracked",
  });
});

export const getFunnelSummary = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const days = Math.min(90, Math.max(1, Number(req.query.days) || 30));
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const grouped = await AnalyticsEvent.aggregate<{
    _id: string;
    count: number;
    uniqueUsers: number;
  }>([
    { $match: { createdAt: { $gte: start } } },
    {
      $group: {
        _id: "$eventName",
        count: { $sum: 1 },
        users: { $addToSet: "$userId" },
      },
    },
    {
      $project: {
        count: 1,
        uniqueUsers: { $size: "$users" },
      },
    },
    { $sort: { count: -1 } },
  ]);

  res.status(200).json({
    success: true,
    message: "Funnel summary retrieved",
    data: {
      days,
      events: grouped.map((entry) => ({
        eventName: entry._id,
        count: entry.count,
        uniqueUsers: entry.uniqueUsers,
      })),
    },
  });
});
