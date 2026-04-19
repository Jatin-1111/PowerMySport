import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express, { Express } from "express";
import request from "supertest";
import {
  adminCreateCoachPlanSchema,
  adminReviewCoachOverrideSchema,
  adminUpdateCoachPlanSchema,
  coachSubscriptionCancelSchema,
  coachSubscriptionCreateSchema,
  coachSubscriptionOverrideRequestSchema,
} from "../middleware/schemas";
import { validateRequest } from "../middleware/validation";

const createTestApp = (): Express => {
  const app = express();
  app.use(express.json());

  app.post(
    "/coaches/subscription/subscribe",
    validateRequest(coachSubscriptionCreateSchema),
    (req, res) => {
      res.status(200).json({ success: true, data: req.body });
    },
  );

  app.post(
    "/coaches/subscription/cancel",
    validateRequest(coachSubscriptionCancelSchema),
    (req, res) => {
      res.status(200).json({ success: true, data: req.body });
    },
  );

  app.post(
    "/coaches/subscription/override-request",
    validateRequest(coachSubscriptionOverrideRequestSchema),
    (req, res) => {
      res.status(200).json({ success: true, data: req.body });
    },
  );

  app.post(
    "/admin/coach-plans",
    validateRequest(adminCreateCoachPlanSchema),
    (req, res) => {
      res.status(200).json({ success: true, data: req.body });
    },
  );

  app.patch(
    "/admin/coach-plans/:planId",
    validateRequest(adminUpdateCoachPlanSchema),
    (req, res) => {
      res.status(200).json({ success: true, data: req.body });
    },
  );

  app.patch(
    "/admin/coach-subscription-overrides/:requestId/review",
    validateRequest(adminReviewCoachOverrideSchema),
    (req, res) => {
      res.status(200).json({ success: true, data: req.body });
    },
  );

  return app;
};

describe("coach subscription route schemas", () => {
  const app = createTestApp();

  it("validates subscribe payload", async () => {
    const good = await request(app)
      .post("/coaches/subscription/subscribe")
      .send({ planId: "plan_1", billingCycle: "MONTHLY" });

    assert.equal(good.status, 200);
    assert.equal(good.body.success, true);

    const bad = await request(app)
      .post("/coaches/subscription/subscribe")
      .send({ billingCycle: "MONTHLY" });

    assert.equal(bad.status, 400);
    assert.equal(bad.body.success, false);
  });

  it("validates override request note", async () => {
    const bad = await request(app)
      .post("/coaches/subscription/override-request")
      .send({ note: "no" });

    assert.equal(bad.status, 400);

    const good = await request(app)
      .post("/coaches/subscription/override-request")
      .send({
        note: "Please allow discounted yearly plan",
        requestedPlanId: "abc123",
      });

    assert.equal(good.status, 200);
    assert.equal(good.body.data.note, "Please allow discounted yearly plan");
  });

  it("validates admin create plan payload", async () => {
    const bad = await request(app).post("/admin/coach-plans").send({
      code: "PRO",
      name: "Pro",
      pricing: {},
    });

    assert.equal(bad.status, 400);

    const good = await request(app)
      .post("/admin/coach-plans")
      .send({
        code: "PRO",
        name: "Pro",
        pricing: { monthly: 999, yearly: 9999 },
        features: ["Priority listing", "Advanced analytics"],
      });

    assert.equal(good.status, 200);
    assert.equal(good.body.success, true);
  });

  it("validates admin update plan payload non-empty", async () => {
    const bad = await request(app).patch("/admin/coach-plans/plan1").send({});
    assert.equal(bad.status, 400);

    const good = await request(app)
      .patch("/admin/coach-plans/plan1")
      .send({ isActive: false });

    assert.equal(good.status, 200);
    assert.equal(good.body.data.isActive, false);
  });

  it("validates admin override review status", async () => {
    const bad = await request(app)
      .patch("/admin/coach-subscription-overrides/req1/review")
      .send({ status: "PENDING" });

    assert.equal(bad.status, 400);

    const good = await request(app)
      .patch("/admin/coach-subscription-overrides/req1/review")
      .send({ status: "APPROVED", reviewNote: "Approved for pilot cohort" });

    assert.equal(good.status, 200);
    assert.equal(good.body.data.status, "APPROVED");
  });

  it("accepts optional cancel reason", async () => {
    const noReason = await request(app)
      .post("/coaches/subscription/cancel")
      .send({});

    assert.equal(noReason.status, 200);

    const withReason = await request(app)
      .post("/coaches/subscription/cancel")
      .send({ reason: "Not using enough yet" });

    assert.equal(withReason.status, 200);
    assert.equal(withReason.body.data.reason, "Not using enough yet");
  });
});
