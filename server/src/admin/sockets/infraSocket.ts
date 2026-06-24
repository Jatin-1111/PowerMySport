import { Server as SocketIOServer, Socket } from "socket.io";
import { isTokenRevoked, verifyToken } from "../../utils/jwt";
import { isSystemAdminRole } from "../../utils/permissions";
import { ADMIN_ROLES } from "../../constants/adminPermissions";
import {
  getInfraMetrics,
  getInfraOverview,
} from "../services/InfraMonitoringService";

const OVERVIEW_INTERVAL_MS = 15000;
const METRICS_INTERVAL_MS = 30000;
const DEFAULT_HOURS = 6;

const isAdminRole = (role?: string): boolean =>
  isSystemAdminRole(role) ||
  Object.values(ADMIN_ROLES).includes(role as never);

const extractToken = (socket: Socket): string | null => {
  const authToken = (
    socket.handshake.auth?.token as string | undefined
  )?.trim();
  const bearer = (socket.handshake.headers.authorization as string | undefined)
    ?.replace(/^Bearer\s+/i, "")
    .trim();

  let cookieToken: string | null = null;
  const cookieHeader = socket.handshake.headers.cookie;
  if (cookieHeader) {
    for (const piece of cookieHeader.split(";")) {
      const [rawKey, ...rest] = piece.split("=");
      if (rawKey?.trim() === "token") {
        cookieToken = rest.join("=").trim() || null;
        break;
      }
    }
  }

  return authToken || bearer || cookieToken || null;
};

/**
 * /infra namespace — pushes live server-monitoring data to admins.
 *
 * A single per-instance loop fetches the infra snapshot (re-using the Redis
 * cache in InfraMonitoringService) and pushes it to the admins connected to
 * THIS instance. Sticky sessions keep each admin pinned to one instance, so
 * the per-instance runtime/RAM stats stay coherent for their session. The
 * loop only runs while at least one admin is connected.
 */
export const setupInfraSocket = (io: SocketIOServer): void => {
  const ns = io.of("/infra");

  let overviewTimer: NodeJS.Timeout | null = null;
  let metricsTimer: NodeJS.Timeout | null = null;

  const localSockets = (): Socket[] => Array.from(ns.sockets.values());

  const pushOverviewToAll = async (): Promise<void> => {
    const sockets = localSockets();
    if (sockets.length === 0) return;
    try {
      const data = await getInfraOverview();
      for (const s of sockets) s.emit("infra:overview", data);
    } catch {
      /* best-effort */
    }
  };

  const pushMetricsToSocket = async (socket: Socket): Promise<void> => {
    try {
      const hours = (socket.data.hours as number) || DEFAULT_HOURS;
      const data = await getInfraMetrics(hours);
      socket.emit("infra:metrics", data);
    } catch {
      /* best-effort */
    }
  };

  const pushMetricsToAll = async (): Promise<void> => {
    const sockets = localSockets();
    if (sockets.length === 0) return;
    await Promise.all(sockets.map((s) => pushMetricsToSocket(s)));
  };

  const startLoops = (): void => {
    if (!overviewTimer) {
      overviewTimer = setInterval(() => {
        void pushOverviewToAll();
      }, OVERVIEW_INTERVAL_MS);
    }
    if (!metricsTimer) {
      metricsTimer = setInterval(() => {
        void pushMetricsToAll();
      }, METRICS_INTERVAL_MS);
    }
  };

  const stopLoops = (): void => {
    if (overviewTimer) {
      clearInterval(overviewTimer);
      overviewTimer = null;
    }
    if (metricsTimer) {
      clearInterval(metricsTimer);
      metricsTimer = null;
    }
  };

  // Admin-only auth on the namespace.
  ns.use((socket, next) => {
    (async () => {
      const token = extractToken(socket);
      if (!token) return next(new Error("Unauthorized"));
      try {
        const payload = verifyToken(token);
        if (await isTokenRevoked(payload.jti)) {
          return next(new Error("Unauthorized"));
        }
        if (!isAdminRole(payload.role)) {
          return next(new Error("Forbidden"));
        }
        socket.data.adminId = payload.id;
        socket.data.hours = DEFAULT_HOURS;
        next();
      } catch {
        next(new Error("Unauthorized"));
      }
    })();
  });

  ns.on("connection", (socket) => {
    // Immediate snapshot for this socket so the tab paints without waiting.
    void getInfraOverview()
      .then((data) => socket.emit("infra:overview", data))
      .catch(() => {});
    void pushMetricsToSocket(socket);

    startLoops();

    // Admin picks a different chart window.
    socket.on("infra:setRange", (hours: unknown) => {
      const parsed = Math.min(168, Math.max(1, Number(hours) || DEFAULT_HOURS));
      socket.data.hours = parsed;
      void pushMetricsToSocket(socket);
    });

    socket.on("disconnect", () => {
      if (ns.sockets.size === 0) stopLoops();
    });
  });
};
