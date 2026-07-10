import {
  DescribeEnvironmentHealthCommand,
  DescribeEnvironmentResourcesCommand,
  DescribeEnvironmentsCommand,
  DescribeEventsCommand,
  DescribeInstancesHealthCommand,
  ElasticBeanstalkClient,
} from "@aws-sdk/client-elastic-beanstalk";
import {
  CloudWatchClient,
  GetMetricDataCommand,
  MetricDataQuery,
} from "@aws-sdk/client-cloudwatch";
import os from "os";
import redis from "../../config/redis";

// ─── Config ────────────────────────────────────────────────────────────────────

const REGION = process.env.AWS_REGION || "ap-south-1";
const ENV_NAME =
  process.env.AWS_EB_ENVIRONMENT_NAME || "powermysport-api-docker";
const APP_NAME = process.env.AWS_EB_APPLICATION_NAME || "PowerMySport-API";

const OVERVIEW_CACHE_KEY = "infra:overview";
const OVERVIEW_TTL_SEC = 30;
const METRICS_CACHE_PREFIX = "infra:metrics:";
const METRICS_TTL_SEC = 60;

// Mirror S3Service: use explicit keys when present, else the default chain.
const credentials =
  process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined;

let ebClient: ElasticBeanstalkClient | null = null;
let cwClient: CloudWatchClient | null = null;

const getEb = (): ElasticBeanstalkClient => {
  if (!ebClient) {
    ebClient = new ElasticBeanstalkClient({
      region: REGION,
      ...(credentials ? { credentials } : {}),
    });
  }
  return ebClient;
};

const getCw = (): CloudWatchClient => {
  if (!cwClient) {
    cwClient = new CloudWatchClient({
      region: REGION,
      ...(credentials ? { credentials } : {}),
    });
  }
  return cwClient;
};

// ─── Small Redis cache helpers (fail-open) ──────────────────────────────────────

const readCache = async <T>(key: string): Promise<T | null> => {
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const writeCache = async (
  key: string,
  value: unknown,
  ttlSec: number,
): Promise<void> => {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSec);
  } catch {
    /* fail open */
  }
};

const round = (value: number | undefined | null, dp = 0): number => {
  if (value === undefined || value === null || Number.isNaN(value)) return 0;
  const factor = 10 ** dp;
  return Math.round(value * factor) / factor;
};

// ─── Types returned to the admin UI ─────────────────────────────────────────────

export interface InfraOverview {
  available: boolean;
  error?: string;
  region: string;
  environmentName: string;
  refreshedAt: string;
  environment: {
    status?: string | undefined;
    health?: string | undefined;
    healthStatus?: string | undefined;
    color?: string | undefined;
    versionLabel?: string | undefined;
    endpointUrl?: string | undefined;
    dateUpdated?: string | undefined;
    causes: string[];
  } | null;
  application: {
    requestCount: number;
    durationSec: number;
    statusCodes: { p2xx: number; p3xx: number; p4xx: number; p5xx: number };
    latencyMs: { p50: number; p90: number; p99: number };
  } | null;
  instanceCounts: Record<string, number>;
  instances: Array<{
    instanceId: string;
    health?: string | undefined;
    color?: string | undefined;
    cpuBusyPct: number;
    loadAvg: number[];
    version?: string | undefined;
    launchedAt?: string | undefined;
    causes: string[];
  }>;
  events: Array<{
    date?: string | undefined;
    severity?: string | undefined;
    message?: string | undefined;
  }>;
  // Live runtime stats of the instance serving this request (sticky sessions
  // keep an admin pinned to one instance, so this stays coherent per session).
  runtime?: RuntimeStats;
}

export interface RuntimeStats {
  hostname: string;
  uptimeSec: number;
  cpuCount: number;
  loadAvg: number[];
  memory: {
    totalMb: number;
    usedMb: number;
    freeMb: number;
    usedPct: number;
    processRssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
  };
}

const toMb = (bytes: number): number => Math.round(bytes / 1024 / 1024);

// Real RAM/runtime of THIS Node instance — read live (never cached) so it
// reflects the box actually serving the admin. EB/CloudWatch don't expose
// memory without the CloudWatch agent, so this is the available source.
export const getRuntimeStats = (): RuntimeStats => {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const mem = process.memoryUsage();
  return {
    hostname: os.hostname(),
    uptimeSec: Math.round(process.uptime()),
    cpuCount: os.cpus().length,
    loadAvg: os.loadavg().map((n) => Math.round(n * 100) / 100),
    memory: {
      totalMb: toMb(total),
      usedMb: toMb(used),
      freeMb: toMb(free),
      usedPct: total > 0 ? Math.round((used / total) * 100) : 0,
      processRssMb: toMb(mem.rss),
      heapUsedMb: toMb(mem.heapUsed),
      heapTotalMb: toMb(mem.heapTotal),
    },
  };
};

interface MetricPoint {
  t: string;
  v: number;
}

export interface InfraMetrics {
  available: boolean;
  error?: string;
  hours: number;
  periodSec: number;
  series: {
    cpuPct: MetricPoint[];
    requestCount: MetricPoint[];
    latencyMs: MetricPoint[];
    errors4xx: MetricPoint[];
    errors5xx: MetricPoint[];
  };
}

// ─── Overview (Elastic Beanstalk enhanced health) ───────────────────────────────

const computeCpuBusy = (cpu?: {
  Idle?: number | undefined;
  IOWait?: number | undefined;
}): number => {
  if (!cpu || cpu.Idle === undefined) return 0;
  const idle = (cpu.Idle ?? 0) + (cpu.IOWait ?? 0);
  return Math.max(0, Math.min(100, round(100 - idle)));
};

export const getInfraOverview = async (
  forceFresh = false,
): Promise<InfraOverview> => {
  if (!forceFresh) {
    const cached = await readCache<InfraOverview>(OVERVIEW_CACHE_KEY);
    if (cached) return { ...cached, runtime: getRuntimeStats() };
  }

  const base: InfraOverview = {
    available: false,
    region: REGION,
    environmentName: ENV_NAME,
    refreshedAt: new Date().toISOString(),
    environment: null,
    application: null,
    instanceCounts: {},
    instances: [],
    events: [],
  };

  const [envRes, healthRes, instancesRes, eventsRes] = await Promise.allSettled(
    [
      getEb().send(
        new DescribeEnvironmentsCommand({
          ApplicationName: APP_NAME,
          EnvironmentNames: [ENV_NAME],
        }),
      ),
      getEb().send(
        new DescribeEnvironmentHealthCommand({
          EnvironmentName: ENV_NAME,
          AttributeNames: ["All"],
        }),
      ),
      getEb().send(
        new DescribeInstancesHealthCommand({
          EnvironmentName: ENV_NAME,
          AttributeNames: ["All"],
        }),
      ),
      getEb().send(
        new DescribeEventsCommand({
          EnvironmentName: ENV_NAME,
          MaxRecords: 15,
        }),
      ),
    ],
  );

  // If every call failed (e.g. bad credentials / no permissions), surface it.
  if (
    envRes.status === "rejected" &&
    healthRes.status === "rejected" &&
    instancesRes.status === "rejected"
  ) {
    const reason =
      healthRes.reason instanceof Error
        ? healthRes.reason.message
        : "Unable to reach Elastic Beanstalk";
    return { ...base, error: reason, runtime: getRuntimeStats() };
  }

  if (envRes.status === "fulfilled") {
    const env = envRes.value.Environments?.[0];
    if (env) {
      base.environment = {
        status: env.Status,
        health: env.Health,
        healthStatus: env.HealthStatus,
        versionLabel: env.VersionLabel,
        endpointUrl: env.EndpointURL,
        dateUpdated: env.DateUpdated?.toISOString(),
        causes: [],
      };
    }
  }

  if (healthRes.status === "fulfilled") {
    const health = healthRes.value;
    base.environment = {
      ...(base.environment ?? { causes: [] }),
      health: base.environment?.health ?? health.HealthStatus,
      healthStatus: health.HealthStatus ?? base.environment?.healthStatus,
      status: health.Status ?? base.environment?.status,
      color: health.Color,
      causes: health.Causes ?? [],
    };

    const app = health.ApplicationMetrics;
    if (app) {
      base.application = {
        requestCount: app.RequestCount ?? 0,
        durationSec: app.Duration ?? 0,
        statusCodes: {
          p2xx: app.StatusCodes?.Status2xx ?? 0,
          p3xx: app.StatusCodes?.Status3xx ?? 0,
          p4xx: app.StatusCodes?.Status4xx ?? 0,
          p5xx: app.StatusCodes?.Status5xx ?? 0,
        },
        latencyMs: {
          p50: round((app.Latency?.P50 ?? 0) * 1000),
          p90: round((app.Latency?.P90 ?? 0) * 1000),
          p99: round((app.Latency?.P99 ?? 0) * 1000),
        },
      };
    }

    const counts = health.InstancesHealth;
    if (counts) {
      base.instanceCounts = {
        Ok: counts.Ok ?? 0,
        Info: counts.Info ?? 0,
        Warning: counts.Warning ?? 0,
        Degraded: counts.Degraded ?? 0,
        Severe: counts.Severe ?? 0,
        Pending: counts.Pending ?? 0,
        Unknown: counts.Unknown ?? 0,
        NoData: counts.NoData ?? 0,
      };
    }
  }

  if (instancesRes.status === "fulfilled") {
    base.instances = (instancesRes.value.InstanceHealthList ?? []).map(
      (inst) => ({
        instanceId: inst.InstanceId ?? "unknown",
        health: inst.HealthStatus,
        color: inst.Color,
        cpuBusyPct: computeCpuBusy(inst.System?.CPUUtilization),
        loadAvg: (inst.System?.LoadAverage ?? []).map((n) => round(n, 2)),
        version: inst.Deployment?.VersionLabel,
        launchedAt: inst.LaunchedAt?.toISOString(),
        causes: inst.Causes ?? [],
      }),
    );
  }

  if (eventsRes.status === "fulfilled") {
    base.events = (eventsRes.value.Events ?? []).map((event) => ({
      date: event.EventDate?.toISOString(),
      severity: event.Severity,
      message: event.Message,
    }));
  }

  base.available = true;
  base.refreshedAt = new Date().toISOString();
  // Cache only the EB portion; runtime is attached fresh on every return so it
  // always reflects the instance serving the caller, not whoever filled cache.
  await writeCache(OVERVIEW_CACHE_KEY, base, OVERVIEW_TTL_SEC);
  return { ...base, runtime: getRuntimeStats() };
};

// ─── Time-series metrics (CloudWatch) ───────────────────────────────────────────

const pickPeriod = (hours: number): number => {
  if (hours <= 3) return 300; // 5 min
  if (hours <= 24) return 900; // 15 min
  return 3600; // 1 hour
};

// EB returns the ALB as an ARN; CloudWatch wants the trailing "app/<name>/<id>".
const deriveLbDimension = (raw?: string): string | undefined => {
  if (!raw) return undefined;
  const marker = ":loadbalancer/";
  const idx = raw.indexOf(marker);
  return idx >= 0 ? raw.slice(idx + marker.length) : raw;
};

const toPoints = (
  timestamps: Date[] | undefined,
  values: number[] | undefined,
  scale = 1,
): MetricPoint[] => {
  if (!timestamps || !values) return [];
  return timestamps.map((ts, i) => ({
    t: ts.toISOString(),
    v: round((values[i] ?? 0) * scale, 2),
  }));
};

export const getInfraMetrics = async (
  hours: number,
  forceFresh = false,
): Promise<InfraMetrics> => {
  const cacheKey = `${METRICS_CACHE_PREFIX}${hours}`;
  if (!forceFresh) {
    const cached = await readCache<InfraMetrics>(cacheKey);
    if (cached) return cached;
  }

  const periodSec = pickPeriod(hours);
  const result: InfraMetrics = {
    available: false,
    hours,
    periodSec,
    series: {
      cpuPct: [],
      requestCount: [],
      latencyMs: [],
      errors4xx: [],
      errors5xx: [],
    },
  };

  let asg: string | undefined;
  let lbDim: string | undefined;
  try {
    const resources = await getEb().send(
      new DescribeEnvironmentResourcesCommand({ EnvironmentName: ENV_NAME }),
    );
    asg = resources.EnvironmentResources?.AutoScalingGroups?.[0]?.Name;
    lbDim = deriveLbDimension(
      resources.EnvironmentResources?.LoadBalancers?.[0]?.Name,
    );
  } catch (error) {
    result.error =
      error instanceof Error
        ? error.message
        : "Unable to resolve environment resources";
    return result;
  }

  const queries: MetricDataQuery[] = [];
  if (asg) {
    queries.push({
      Id: "cpu",
      MetricStat: {
        Metric: {
          Namespace: "AWS/EC2",
          MetricName: "CPUUtilization",
          Dimensions: [{ Name: "AutoScalingGroupName", Value: asg }],
        },
        Period: periodSec,
        Stat: "Average",
      },
    });
  }
  if (lbDim) {
    queries.push(
      {
        Id: "req",
        MetricStat: {
          Metric: {
            Namespace: "AWS/ApplicationELB",
            MetricName: "RequestCount",
            Dimensions: [{ Name: "LoadBalancer", Value: lbDim }],
          },
          Period: periodSec,
          Stat: "Sum",
        },
      },
      {
        Id: "lat",
        MetricStat: {
          Metric: {
            Namespace: "AWS/ApplicationELB",
            MetricName: "TargetResponseTime",
            Dimensions: [{ Name: "LoadBalancer", Value: lbDim }],
          },
          Period: periodSec,
          Stat: "Average",
        },
      },
      {
        Id: "e4xx",
        MetricStat: {
          Metric: {
            Namespace: "AWS/ApplicationELB",
            MetricName: "HTTPCode_Target_4XX_Count",
            Dimensions: [{ Name: "LoadBalancer", Value: lbDim }],
          },
          Period: periodSec,
          Stat: "Sum",
        },
      },
      {
        Id: "e5xx",
        MetricStat: {
          Metric: {
            Namespace: "AWS/ApplicationELB",
            MetricName: "HTTPCode_Target_5XX_Count",
            Dimensions: [{ Name: "LoadBalancer", Value: lbDim }],
          },
          Period: periodSec,
          Stat: "Sum",
        },
      },
    );
  }

  if (queries.length === 0) {
    result.error = "No Auto Scaling group or load balancer found to query.";
    return result;
  }

  try {
    const end = new Date();
    const startMs = end.getTime() - hours * 60 * 60 * 1000;
    const response = await getCw().send(
      new GetMetricDataCommand({
        MetricDataQueries: queries,
        StartTime: new Date(startMs),
        EndTime: end,
        ScanBy: "TimestampAscending",
      }),
    );

    const byId = new Map(
      (response.MetricDataResults ?? []).map((r) => [r.Id, r]),
    );
    const series = (id: string, scale = 1) =>
      toPoints(byId.get(id)?.Timestamps, byId.get(id)?.Values, scale);

    result.series = {
      cpuPct: series("cpu"),
      requestCount: series("req"),
      latencyMs: series("lat", 1000), // seconds → ms
      errors4xx: series("e4xx"),
      errors5xx: series("e5xx"),
    };
    result.available = true;
  } catch (error) {
    result.error =
      error instanceof Error
        ? error.message
        : "Failed to fetch CloudWatch data";
    return result;
  }

  await writeCache(cacheKey, result, METRICS_TTL_SEC);
  return result;
};
