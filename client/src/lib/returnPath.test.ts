import { describe, expect, it } from "vitest";
import { isExternalReturnPath, safeReturnPath } from "./returnPath";

// SITE_URL defaults to https://powermysport.com, and there is no window or
// NEXT_PUBLIC_COMMUNITY_APP_URL under the node test environment, so that is the
// only allowlisted origin here.

describe("safeReturnPath", () => {
  it("accepts site-relative paths, with query and fragment", () => {
    expect(safeReturnPath("/dashboard")).toBe("/dashboard");
    expect(safeReturnPath("/booking?tab=venues")).toBe("/booking?tab=venues");
    expect(safeReturnPath("/venues/abc#reviews")).toBe("/venues/abc#reviews");
  });

  it("accepts an absolute URL on an allowlisted origin", () => {
    expect(safeReturnPath("https://powermysport.com/dashboard")).toBe(
      "https://powermysport.com/dashboard"
    );
  });

  it("rejects an absolute URL on any other origin", () => {
    // The original open redirect: any https:// URL was honoured.
    expect(safeReturnPath("https://evil.example/harvest")).toBeNull();
    expect(safeReturnPath("http://evil.example")).toBeNull();
  });

  it("rejects lookalike hosts that merely contain an allowlisted one", () => {
    expect(safeReturnPath("https://powermysport.com.evil.example")).toBeNull();
    expect(safeReturnPath("https://evil.example/?x=powermysport.com")).toBeNull();
    expect(safeReturnPath("https://notpowermysport.com")).toBeNull();
  });

  it("rejects protocol-relative URLs that look path-like", () => {
    expect(safeReturnPath("//evil.example")).toBeNull();
    expect(safeReturnPath("//evil.example/harvest")).toBeNull();
  });

  it("rejects backslash variants browsers may normalise to slashes", () => {
    expect(safeReturnPath("/\\evil.example")).toBeNull();
    expect(safeReturnPath("\\\\evil.example")).toBeNull();
    expect(safeReturnPath("/dashboard\\..\\x")).toBeNull();
  });

  it("rejects non-http schemes", () => {
    expect(safeReturnPath("javascript:alert(1)")).toBeNull();
    expect(safeReturnPath("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeReturnPath("file:///etc/passwd")).toBeNull();
  });

  it("rejects embedded control characters", () => {
    // Written as escape sequences — never as raw control bytes in the source,
    // which makes the file unreadable to text tooling.
    expect(safeReturnPath("/dashboard\nSet-Cookie: x=1")).toBeNull();
    expect(safeReturnPath("java\tscript:alert(1)")).toBeNull();
    expect(safeReturnPath(`/dash${String.fromCharCode(0)}board`)).toBeNull();
    expect(safeReturnPath(`/dash${String.fromCharCode(0x7f)}board`)).toBeNull();
  });

  it("allows a plain space, which is not a control character", () => {
    // Documents where the line is drawn. A space is harmless — the router
    // percent-encodes it — so rejecting it would block valid paths for no gain.
    // Only C0 controls and DEL are stripped, because those are what get used to
    // smuggle past prefix checks and split headers.
    expect(safeReturnPath("/dash board")).toBe("/dash board");
  });

  it("rejects bare hostnames and other non-paths", () => {
    expect(safeReturnPath("evil.example")).toBeNull();
    expect(safeReturnPath("dashboard")).toBeNull();
  });

  it("returns null for empty and missing input", () => {
    expect(safeReturnPath(null)).toBeNull();
    expect(safeReturnPath(undefined)).toBeNull();
    expect(safeReturnPath("")).toBeNull();
    expect(safeReturnPath("   ")).toBeNull();
  });
});

describe("isExternalReturnPath", () => {
  it("distinguishes full navigations from router pushes", () => {
    expect(isExternalReturnPath("https://powermysport.com/x")).toBe(true);
    expect(isExternalReturnPath("/dashboard")).toBe(false);
  });
});
