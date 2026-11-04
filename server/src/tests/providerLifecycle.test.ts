// The one status vocabulary: how each provider type's existing fields map onto it.
import assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const { deriveLifecycle, LIFECYCLES } = require("../shared/services/providerLifecycle");

describe("coach lifecycle", () => {
  const table: [string | undefined, string][] = [
    [undefined, "DRAFT"],
    ["UNVERIFIED", "DRAFT"],
    ["PENDING", "SUBMITTED"],
    ["REVIEW", "NEEDS_INFO"],
    ["VERIFIED", "APPROVED"],
    ["REJECTED", "REJECTED"],
  ];
  for (const [status, expected] of table) {
    it(`${status ?? "no status"} is ${expected}`, () => {
      assert.equal(deriveLifecycle("coach", { verificationStatus: status }), expected);
    });
  }
});

describe("expert lifecycle", () => {
  it("maps the review states", () => {
    assert.equal(deriveLifecycle("expert", { verificationStatus: "UNVERIFIED" }), "DRAFT");
    assert.equal(deriveLifecycle("expert", { verificationStatus: "PENDING" }), "SUBMITTED");
    assert.equal(deriveLifecycle("expert", { verificationStatus: "REJECTED" }), "REJECTED");
  });
  it("is Approved while active and Suspended once switched off", () => {
    assert.equal(
      deriveLifecycle("expert", { verificationStatus: "APPROVED", isActive: true }),
      "APPROVED"
    );
    assert.equal(
      deriveLifecycle("expert", { verificationStatus: "APPROVED", isActive: false }),
      "SUSPENDED"
    );
  });
});

describe("venue lifecycle", () => {
  it("treats pending with no documents as a draft", () => {
    assert.equal(deriveLifecycle("venue", { approvalStatus: "PENDING", documents: [] }), "DRAFT");
    assert.equal(deriveLifecycle("venue", { approvalStatus: "PENDING" }), "DRAFT");
  });
  it("treats pending with documents as submitted", () => {
    assert.equal(
      deriveLifecycle("venue", {
        approvalStatus: "PENDING",
        documents: [{ type: "OWNERSHIP_PROOF" }],
      }),
      "SUBMITTED"
    );
  });
  it("maps review, approval and rejection", () => {
    assert.equal(deriveLifecycle("venue", { approvalStatus: "REVIEW" }), "NEEDS_INFO");
    assert.equal(deriveLifecycle("venue", { approvalStatus: "APPROVED" }), "APPROVED");
    assert.equal(deriveLifecycle("venue", { approvalStatus: "REJECTED" }), "REJECTED");
  });
});

describe("academy lifecycle", () => {
  it("is a draft until onboarding is submitted", () => {
    assert.equal(deriveLifecycle("academy", { onboardingCompleted: false }), "DRAFT");
    assert.equal(deriveLifecycle("academy", {}), "DRAFT");
  });
  it("is submitted once handed in and not yet decided", () => {
    assert.equal(
      deriveLifecycle("academy", { onboardingCompleted: true, isApproved: false }),
      "SUBMITTED"
    );
    assert.equal(
      deriveLifecycle("academy", {
        onboardingCompleted: true,
        isApproved: false,
        rejectionReason: "  ",
      }),
      "SUBMITTED"
    );
  });
  it("is rejected when a reason is on record", () => {
    assert.equal(
      deriveLifecycle("academy", {
        onboardingCompleted: true,
        isApproved: false,
        rejectionReason: "Documents unreadable",
      }),
      "REJECTED"
    );
  });
  it("is approved when live, needs info while only the KYC check is missing, suspended when switched off", () => {
    assert.equal(
      deriveLifecycle("academy", { isApproved: true, isActive: true, kycVerified: true }),
      "APPROVED"
    );
    assert.equal(
      deriveLifecycle("academy", { isApproved: true, isActive: false, kycVerified: false }),
      "NEEDS_INFO"
    );
    assert.equal(
      deriveLifecycle("academy", { isApproved: true, isActive: false, kycVerified: true }),
      "SUSPENDED"
    );
  });
});

describe("vocabulary", () => {
  it("is exactly six words, shared by every type", () => {
    assert.deepEqual(
      [...LIFECYCLES],
      ["DRAFT", "SUBMITTED", "NEEDS_INFO", "APPROVED", "REJECTED", "SUSPENDED"]
    );
  });
});
