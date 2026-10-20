import { describe, expect, it } from "vitest";
import { resolveApiPath } from "@/lib/api/resolveApiPath";

describe("resolveApiPath", () => {
  const prod = "https://api.powermysport.com/api";

  it("points a server route at the API, not at the website", () => {
    expect(resolveApiPath("/api/guidance/abc123/whatsapp", prod)).toBe(
      "https://api.powermysport.com/api/guidance/abc123/whatsapp"
    );
  });

  it("works against the local API", () => {
    expect(resolveApiPath("/api/guidance/abc123/whatsapp", "http://localhost:5000/api")).toBe(
      "http://localhost:5000/api/guidance/abc123/whatsapp"
    );
  });

  it("does not double the /api segment", () => {
    expect(resolveApiPath("/api/x", prod)).not.toContain("/api/api");
  });

  it("copes with a trailing slash on the base", () => {
    expect(resolveApiPath("/api/guidance/1/whatsapp", `${prod}/`)).toBe(
      "https://api.powermysport.com/api/guidance/1/whatsapp"
    );
  });

  it("accepts a path without the /api prefix", () => {
    expect(resolveApiPath("/guidance/1/whatsapp", prod)).toBe(
      "https://api.powermysport.com/api/guidance/1/whatsapp"
    );
  });

  it("leaves a full URL alone", () => {
    expect(resolveApiPath("https://wa.me/918968582443", prod)).toBe("https://wa.me/918968582443");
  });
});
