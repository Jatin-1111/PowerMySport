import { Request, Response } from "express";
import { WebhookRecoveryService } from "../../../shared/controllers/WebhookController";
import { asyncHandler } from "../../../middleware/asyncHandler";
import { AppError } from "../../../utils/AppError";

// ============ WEBHOOK RECOVERY ============

/**
 * List webhook errors
 * GET /api/admin/webhook-errors
 */
export const listWebhookErrors = asyncHandler(async (req: Request, res: Response) => {
  const errors = WebhookRecoveryService.listErrors();
  res.status(200).json({
    success: true,
    data: errors,
  });
});

/**
 * Retry webhook error
 * POST /api/admin/webhook-errors/:key/retry
 */
export const retryWebhookError = asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;

  // We instantiate the service and call retryFailedWebhook
  const recoveryService = new WebhookRecoveryService();
  await recoveryService.retryFailedWebhook(key as string);

  res.status(200).json({
    success: true,
    message: "Webhook retry executed",
  });
});

/**
 * Reconcile order
 * POST /api/admin/reconcile/:type/:orderId
 */
export const reconcileOrderAdmin = asyncHandler(async (req: Request, res: Response) => {
  const type = req.params.type as string;
  const orderId = req.params.orderId as string;

  const recoveryService = new WebhookRecoveryService();
  let consistent = false;
  let details = {};

  if (type === "booking" || type === "payment") {
    consistent = await recoveryService.reconcileOrderPayment(orderId);
    details = { status: "CHECKED_PAYMENT" };
  } else if (type === "refund") {
    consistent = await recoveryService.reconcileOrderRefund(orderId);
    details = { status: "CHECKED_REFUND" };
  } else {
    throw new AppError("Invalid reconciliation type", 400);
  }

  res.status(200).json({
    success: true,
    data: {
      isConsistent: consistent,
      details,
    },
  });
});
