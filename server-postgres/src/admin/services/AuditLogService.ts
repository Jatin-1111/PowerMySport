import { AdminAuditLog } from "../models/AdminAuditLog";

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
    await AdminAuditLog.create(entry);
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
  const query: Record<string, unknown> = {};
  if (filters.adminId) query.adminId = filters.adminId;
  if (filters.targetType) query.targetType = filters.targetType;

  const safeLimit = Math.min(100, Math.max(1, limit));
  const safePage = Math.max(1, page);

  const [total, entries] = await Promise.all([
    AdminAuditLog.countDocuments(query),
    AdminAuditLog.find(query)
      .populate("adminId", "name email")
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit),
  ]);

  const logs = entries.map((entry) => {
    const admin =
      entry.adminId && typeof entry.adminId === "object"
        ? (entry.adminId as unknown as {
            _id: { toString(): string };
            name?: string;
            email?: string;
          })
        : null;

    return {
      id: entry._id.toString(),
      admin: admin
        ? {
            id: admin._id.toString(),
            ...(admin.name ? { name: admin.name } : {}),
            email: admin.email || entry.adminEmail,
          }
        : { id: "", email: entry.adminEmail },
      action: entry.action,
      targetType: entry.targetType,
      ...(entry.targetId ? { targetId: entry.targetId } : {}),
      ...(entry.metadata ? { metadata: entry.metadata } : {}),
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
