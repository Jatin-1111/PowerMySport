import { afterEach, describe, expect, it, vi } from "vitest";

type HeaderRule = {
  source: string;
  has?: Array<{ type: string; value?: string }>;
  headers: Array<{ key: string; value: string }>;
};

async function loadRules(): Promise<HeaderRule[]> {
  vi.resetModules();
  const config = (await import("../next.config")).default;
  return (await config.headers?.()) as HeaderRule[];
}

const hostOf = (rule: HeaderRule) => rule.has?.find((cond) => cond.type === "host")?.value;

describe("noindex for non-production hosts", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("noindexes the UAT host", async () => {
    const rules = await loadRules();
    const uat = rules.find((rule) => hostOf(rule) === "client-uat.powermysport.com");
    expect(uat).toBeDefined();
    expect(uat?.source).toBe("/:path*");
    expect(uat?.headers).toContainEqual({ key: "X-Robots-Tag", value: "noindex, nofollow" });
  });

  it("can never apply to production: every rule is host-conditional and none names it", async () => {
    vi.stubEnv("NOINDEX_HOSTS", "preview.example.com");
    const rules = await loadRules();
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      // An unconditional rule would noindex every host, production included.
      expect(hostOf(rule)).toBeTruthy();
      expect(hostOf(rule)).not.toBe("powermysport.com");
      expect(hostOf(rule)).not.toBe("www.powermysport.com");
    }
  });

  it("adds hosts from NOINDEX_HOSTS, trimming blanks", async () => {
    vi.stubEnv("NOINDEX_HOSTS", " preview.example.com , ,staging.example.com");
    const hosts = (await loadRules()).map(hostOf);
    expect(hosts).toEqual(expect.arrayContaining(["preview.example.com", "staging.example.com"]));
    expect(hosts).not.toContain("");
  });
});
