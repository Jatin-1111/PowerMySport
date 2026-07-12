import { Prisma } from "@prisma/client";
import prisma from "../../lib/prisma";

interface RecordAuditLogInput {
  adminId: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget audit write. Never throws — a logging failure must not
 * fail the admin action it's recording.
 */
export const recordAuditLog = async (
  entry: RecordAuditLogInput,
): Promise<void> => {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminId: entry.adminId,
        adminEmail: entry.adminEmail,
        action: entry.action,
        targetType: entry.targetType,
        ...(entry.targetId ? { targetId: entry.targetId } : {}),
        ...(entry.metadata
          ? { metadata: entry.metadata as Prisma.InputJsonValue }
          : {}),
      },
    });
  } catch (error) {
    console.error("Failed to record audit log entry:", error);
  }
};

export const listAuditLogs = async (
  page = 1,
  limit = 25,
  filters: { adminId?: string; targetType?: string } = {},
): Promise<{
  logs: Array<{
    id: string;
    admin: { id: string; name?: string; email: string } | null;
    action: string;
    targetType: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
  }>;
  total: number;
  page: number;
  totalPages: number;
}> => {
  const where: Prisma.AdminAuditLogWhereInput = {};
  if (filters.adminId) where.adminId = filters.adminId;
  if (filters.targetType) where.targetType = filters.targetType;

  const safeLimit = Math.min(100, Math.max(1, limit));
  const safePage = Math.max(1, page);

  const [total, entries] = await Promise.all([
    prisma.adminAuditLog.count({ where }),
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    }),
  ]);

  // Mongo populated adminId (name/email). There is no Prisma relation on the
  // String FK, so resolve the admins in one query and join in code (see
  // PORTING_GUIDE §1 populate helper).
  const adminIds = [...new Set(entries.map((entry) => entry.adminId))];
  const admins = adminIds.length
    ? await prisma.admin.findMany({
        where: { id: { in: adminIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const adminById = new Map(admins.map((a) => [a.id, a]));

  const logs = entries.map((entry) => {
    const admin = adminById.get(entry.adminId) ?? null;

    return {
      id: entry.id.toString(),
      admin: admin
        ? {
            id: admin.id.toString(),
            ...(admin.name ? { name: admin.name } : {}),
            email: admin.email || entry.adminEmail,
          }
        : { id: "", email: entry.adminEmail },
      action: entry.action,
      targetType: entry.targetType,
      ...(entry.targetId ? { targetId: entry.targetId } : {}),
      ...(entry.metadata
        ? { metadata: entry.metadata as Record<string, unknown> }
        : {}),
      createdAt: entry.createdAt,
    };
  });

  return {
    logs,
    total,
    page: safePage,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
  };
};
