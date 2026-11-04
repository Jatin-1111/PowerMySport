import { Request, Response } from "express";
import { RefundService } from "../../../shared/services/PaymentService";
import { ApiResponse, FulfillmentStatus, OrderStatus } from "../../../types/ecommerce";
import { PaymentTransaction as PaymentTransactionModel } from "../../models/Ecommerce";
import { OrderService } from "../../services/EcommerceService";
import { getParam } from "./shared";

export class AdminOrdersController {
  private orderService: OrderService;
  private refundService: RefundService;

  constructor() {
    this.orderService = new OrderService();
    this.refundService = new RefundService();
  }

  /**
   * GET /api/v1/admin/orders
   * List all orders
   */
  async listAllOrders(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        dateFrom,
        dateTo,
        search,
        sortBy,
        sortOrder,
      } = req.query;

      const filters: {
        status?: OrderStatus;
        dateFrom?: string;
        dateTo?: string;
        search?: string;
        sortBy?: "createdAt" | "totalAmount" | "orderNumber";
        sortOrder?: "asc" | "desc";
      } = {};

      if (typeof status === "string") {
        filters.status = status as OrderStatus;
      }
      if (typeof dateFrom === "string") {
        filters.dateFrom = dateFrom;
      }
      if (typeof dateTo === "string") {
        filters.dateTo = dateTo;
      }
      if (typeof search === "string") {
        filters.search = search;
      }
      if (sortBy === "createdAt" || sortBy === "totalAmount" || sortBy === "orderNumber") {
        filters.sortBy = sortBy;
      }
      if (sortOrder === "asc" || sortOrder === "desc") {
        filters.sortOrder = sortOrder;
      }

      const result = await this.orderService.listAllOrders(Number(page), Number(limit), filters);

      res.json({
        ok: true,
        data: result,
      } as ApiResponse<any>);
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error.message,
        },
      } as ApiResponse<null>);
    }
  }

  /**
   * GET /api/v1/admin/orders/:orderId
   * Get a single order's full detail (line items + status) for admin drill-down
   */
  async getOrderDetail(req: Request, res: Response): Promise<void> {
    try {
      const orderId = getParam((req.params as Record<string, unknown>).orderId);

      if (!orderId) {
        res.status(400).json({
          ok: false,
          error: { code: "INVALID_REQUEST", message: "Order id is required" },
        });
        return;
      }

      const order = await this.orderService.getOrderByIdForAdmin(orderId);

      if (!order) {
        res.status(404).json({
          ok: false,
          error: { code: "NOT_FOUND", message: "Order not found" },
        });
        return;
      }

      res.json({
        ok: true,
        data: { order },
      } as ApiResponse<any>);
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: { code: "INTERNAL_ERROR", message: error.message },
      } as ApiResponse<null>);
    }
  }

  /**
   * PATCH /api/v1/admin/orders/:orderId/fulfillment-status
   * Update fulfillment status
   */
  async updateFulfillmentStatus(req: Request, res: Response): Promise<void> {
    try {
      const orderId = getParam((req.params as Record<string, unknown>).orderId);
      const { fulfillmentStatus, trackingNumber } = req.body;

      if (!orderId) {
        res.status(400).json({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Order id is required",
          },
        });
        return;
      }

      const order = await this.orderService.updateFulfillmentStatus(
        orderId,
        fulfillmentStatus as FulfillmentStatus,
        trackingNumber
      );

      res.json({
        ok: true,
        data: { order },
      } as ApiResponse<any>);
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: {
          code: "INVALID_STATE_TRANSITION",
          message: error.message,
        },
      } as ApiResponse<null>);
    }
  }

  /**
   * POST /api/v1/admin/orders/:orderId/refund
   * Initiate refund
   */
  async initiateRefund(req: Request, res: Response): Promise<void> {
    try {
      const orderId = getParam((req.params as Record<string, unknown>).orderId);
      const { refundAmount, reason } = req.body;

      if (!orderId) {
        res.status(400).json({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Order id is required",
          },
        });
        return;
      }

      // Use gatewayOrderId (our merchantOrderId) — PhonePe's refund API requires
      // the original merchantOrderId, not the PhonePe-assigned payment ID.
      const paymentTransaction = await PaymentTransactionModel.findOne({
        orderId: orderId,
      }).sort({ createdAt: -1 });

      if (!paymentTransaction?.gatewayOrderId) {
        res.status(400).json({
          ok: false,
          error: {
            code: "PAYMENT_NOT_FOUND",
            message: "No captured payment transaction found for this order",
          },
        });
        return;
      }

      const merchantOrderId = paymentTransaction.gatewayOrderId;

      const refundId = await this.refundService.initiateRefund(
        orderId,
        merchantOrderId,
        refundAmount,
        reason
      );

      res.json({
        ok: true,
        data: { refundId },
      } as ApiResponse<any>);
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: {
          code: "INVALID_REQUEST",
          message: error.message,
        },
      } as ApiResponse<null>);
    }
  }
}
