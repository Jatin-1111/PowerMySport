import { Request, Response } from "express";
import { WebhookRecoveryService } from "../../../shared/controllers/WebhookController";

// ============ WEBHOOK RECOVERY ============

/**
 * List webhook errors
 * GET /api/admin/webhook-errors
 */
export const listWebhookErrors = async (req: Request, res: Response) => {
  try {
    const errors = WebhookRecoveryService.listErrors();
    res.status(200).json({
      success: true,
      data: errors,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch webhook errors",
    });
  }
};

/**
 * Retry webhook error
 * POST /api/admin/webhook-errors/:key/retry
 */
export const retryWebhookError = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;

    // We instantiate the service and call retryFailedWebhook
    const recoveryService = new WebhookRecoveryService();
    await recoveryService.retryFailedWebhook(key as string);

    res.status(200).json({
      success: true,
      message: "Webhook retry executed",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to retry webhook",
    });
  }
};

/**
 * Reconcile order
 * POST /api/admin/reconcile/:type/:orderId
 */
export const reconcileOrderAdmin = async (req: Request, res: Response) => {
  try {
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
      res.status(400).json({ success: false, message: "Invalid reconciliation type" });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        isConsistent: consistent,
        details,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to reconcile order",
    });
  }
};
