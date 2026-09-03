import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { NotificationService } from "../../../client/services/NotificationService";
import { PaymentService } from "../../../shared/services/PaymentService";
import { ApiResponse, OrderStatus, PaymentGateway, PaymentStatus } from "../../../types/ecommerce";
import { PaymentTransaction as PaymentTransactionModel } from "../../models/Ecommerce";
import { OrderService } from "../../services/EcommerceService";
import { log, getParam } from "./shared";

export class OrdersController {
  private orderService: OrderService;
  private paymentService: PaymentService;

  constructor() {
    this.orderService = new OrderService();
    this.paymentService = new PaymentService(PaymentGateway.PHONEPE);
  }

  /**
   * POST /api/v1/orders/create-from-cart
   * Create order from cart
   */
  async createOrderFromCart(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { shippingAddress, paymentMethod } = req.body;

      if (!userId) {
        res.status(401).json({
          ok: false,
          error: {
            code: "UNAUTHORIZED",
            message: "User not authenticated",
          },
        });
        return;
      }

      if (!shippingAddress || !paymentMethod) {
        res.status(400).json({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "shippingAddress and paymentMethod are required",
          },
        });
        return;
      }

      // Create order
      const order = await this.orderService.createOrderFromCart(
        userId,
        shippingAddress,
        paymentMethod,
        PaymentGateway.PHONEPE
      );

      // Initiate payment
      const idempotencyKey = uuidv4();
      const paymentTx = await this.paymentService.initiatePayment(
        order._id.toString(),
        order.totalAmount,
        "INR",
        idempotencyKey,
        PaymentGateway.PHONEPE,
        {
          name: shippingAddress.fullName,
          email: shippingAddress.email,
          phone: shippingAddress.phone,
        }
      );

      // Update order with payment gateway order ID
      order.paymentGatewayOrderId = paymentTx.gatewayOrderId;
      await order.save();

      res.status(201).json({
        ok: true,
        data: {
          order: {
            id: order._id.toString(),
            orderNumber: order.orderNumber,
            status: order.status,
            totalAmount: order.totalAmount,
            paymentGateway: order.paymentGateway,
            paymentGatewayOrderId: order.paymentGatewayOrderId,
            createdAt: order.createdAt,
          },
          paymentConfig: paymentTx.gatewayResponse,
        },
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
   * POST /api/v1/orders/:orderId/verify-payment
   * Verify payment signature
   */
  async verifyPayment(req: Request, res: Response): Promise<void> {
    try {
      const orderId = getParam((req.params as Record<string, unknown>).orderId);
      const { phonepe_payment_id, phonepe_order_id, phonepe_signature } = req.body;

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

      if (!phonepe_payment_id || !phonepe_order_id || !phonepe_signature) {
        res.status(400).json({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Payment credentials are required",
          },
        });
        return;
      }

      // Enforce ownership before confirming payment (prevents acting on
      // another user's order — IDOR).
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          ok: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
        return;
      }

      const existingOrder = await this.orderService.getOrderById(orderId);
      if (
        !existingOrder ||
        (existingOrder.userId.toString() !== userId && (req as any).user?.role !== "Admin")
      ) {
        res.status(404).json({
          ok: false,
          error: { code: "NOT_FOUND", message: "Order not found" },
        });
        return;
      }

      // Verify payment
      const paymentTx = await this.paymentService.verifyAndConfirmPayment(
        orderId,
        phonepe_payment_id,
        phonepe_order_id,
        phonepe_signature
      );

      // Confirm order payment
      const order = await this.orderService.confirmPayment(
        orderId,
        phonepe_payment_id,
        phonepe_order_id
      );

      // Emit payment confirmed notification to the user
      NotificationService.send({
        userId: order.userId.toString(),
        type: "PAYMENT_CONFIRMED",
        title: "Payment Confirmed",
        message: `Your payment for order ${order.orderNumber} has been confirmed. We are processing your order.`,
        data: {
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          confirmedAt: new Date().toISOString(),
        },
      }).catch((err: Error) =>
        log.error("[EcommerceController] Failed to send payment notification:", err)
      );

      res.json({
        ok: true,
        data: {
          order: {
            id: order._id.toString(),
            orderNumber: order.orderNumber,
            status: order.status,
            paymentStatus: order.paymentStatus,
            totalAmount: order.totalAmount,
          },
        },
      } as ApiResponse<any>);
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: {
          code: "PAYMENT_VERIFICATION_FAILED",
          message: error.message,
        },
      } as ApiResponse<null>);
    }
  }

  /**
   * POST /api/v1/orders/:orderId/sync-payment
   * Reconcile an order's payment by polling the gateway for the definitive
   * status. Called by the client after the PhonePe redirect lands back on the
   * order page, so payment confirmation does not depend solely on the webhook.
   */
  async syncPayment(req: Request, res: Response): Promise<void> {
    try {
      const orderId = getParam((req.params as Record<string, unknown>).orderId);
      const userId = (req as any).user?.id;

      if (!orderId) {
        res.status(400).json({
          ok: false,
          error: { code: "INVALID_REQUEST", message: "Order id is required" },
        });
        return;
      }

      const order = await this.orderService.getOrderById(orderId);
      if (!order) {
        res.status(404).json({
          ok: false,
          error: { code: "NOT_FOUND", message: "Order not found" },
        });
        return;
      }

      // Verify ownership (admins may reconcile any order)
      if (order.userId.toString() !== userId && (req as any).user?.role !== "Admin") {
        res.status(403).json({
          ok: false,
          error: { code: "FORBIDDEN", message: "Access denied" },
        });
        return;
      }

      // Already settled, or not in a state we can reconcile — return as-is.
      if (
        order.paymentStatus === PaymentStatus.CAPTURED ||
        order.status !== OrderStatus.PENDING_PAYMENT
      ) {
        res.json({ ok: true, data: order } as ApiResponse<any>);
        return;
      }

      // Look up the latest payment transaction for this order.
      const paymentTx = await PaymentTransactionModel.findOne({
        orderId,
      }).sort({ createdAt: -1 });

      if (!paymentTx?.gatewayOrderId) {
        res.json({ ok: true, data: order } as ApiResponse<any>);
        return;
      }

      // Ask the gateway for the definitive status.
      const gatewayStatus = await this.paymentService
        .getGatewayService()
        .getPaymentStatus(paymentTx.gatewayOrderId);

      if (gatewayStatus === PaymentStatus.CAPTURED) {
        paymentTx.status = PaymentStatus.CAPTURED;
        if (!paymentTx.gatewayPaymentId) {
          paymentTx.gatewayPaymentId = paymentTx.gatewayOrderId;
        }
        await paymentTx.save();

        const updatedOrder = await this.orderService.confirmPayment(
          orderId,
          paymentTx.gatewayPaymentId || paymentTx.gatewayOrderId,
          paymentTx.gatewayOrderId
        );

        NotificationService.send({
          userId: updatedOrder.userId.toString(),
          type: "PAYMENT_CONFIRMED",
          title: "Payment Confirmed",
          message: `Your payment for order ${updatedOrder.orderNumber} has been confirmed. We are processing your order.`,
          data: {
            orderId: updatedOrder._id.toString(),
            orderNumber: updatedOrder.orderNumber,
            totalAmount: updatedOrder.totalAmount,
            confirmedAt: new Date().toISOString(),
          },
        }).catch((err: Error) =>
          log.error("[EcommerceController] Failed to send payment notification:", err)
        );

        res.json({ ok: true, data: updatedOrder } as ApiResponse<any>);
        return;
      }

      // Not captured yet (pending, or a transient gateway error). Leave the
      // order untouched — the authoritative webhook handles genuine failures,
      // and the shopper can retry. We never auto-fail here to avoid releasing
      // inventory on a transient status-check error.
      res.json({ ok: true, data: order } as ApiResponse<any>);
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: { code: "INTERNAL_ERROR", message: error.message },
      } as ApiResponse<null>);
    }
  }

  /**
   * GET /api/v1/orders/:orderId
   * Get order details
   */
  async getOrder(req: Request, res: Response): Promise<void> {
    try {
      const orderId = getParam((req.params as Record<string, unknown>).orderId);
      const userId = (req as any).user?.id;

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

      const order = await this.orderService.getOrderById(orderId);

      if (!order) {
        res.status(404).json({
          ok: false,
          error: {
            code: "NOT_FOUND",
            message: "Order not found",
          },
        });
        return;
      }

      // Verify user owns this order
      if (order.userId.toString() !== userId && (req as any).user?.role !== "Admin") {
        res.status(403).json({
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: "Access denied",
          },
        });
        return;
      }

      res.json({
        ok: true,
        data: order,
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
   * GET /api/v1/orders
   * List user's orders
   */
  async listOrders(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { page = 1, limit = 10, status } = req.query;

      if (!userId) {
        res.status(401).json({
          ok: false,
          error: {
            code: "UNAUTHORIZED",
            message: "User not authenticated",
          },
        });
        return;
      }

      const result = await this.orderService.listUserOrders(
        userId,
        Number(page),
        Number(limit),
        status as OrderStatus
      );

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
   * POST /api/v1/orders/:orderId/cancel
   * Cancel order
   */
  async cancelOrder(req: Request, res: Response): Promise<void> {
    try {
      const orderId = getParam((req.params as Record<string, unknown>).orderId);
      const { reason } = req.body;
      const userId = (req as any).user?.id;

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

      // Verify user owns this order
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId.toString() !== userId) {
        res.status(403).json({
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: "Access denied",
          },
        });
        return;
      }

      const cancelledOrder = await this.orderService.cancelOrder(
        orderId,
        reason || "User cancelled"
      );

      res.json({
        ok: true,
        data: cancelledOrder,
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
   * GET /api/v1/orders/:orderId/invoice/pdf
   * Download order invoice as PDF
   */
  async downloadOrderInvoice(req: Request, res: Response): Promise<void> {
    try {
      const orderId = getParam((req.params as Record<string, unknown>).orderId);
      const userId = (req as any).user?.id;

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

      const order = await this.orderService.getOrderById(orderId);
      if (!order) {
        res.status(404).json({
          ok: false,
          error: {
            code: "NOT_FOUND",
            message: "Order not found",
          },
        });
        return;
      }

      // Verify user owns this order or is admin
      if (order.userId.toString() !== userId && (req as any).user?.role !== "Admin") {
        res.status(403).json({
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: "Access denied",
          },
        });
        return;
      }

      // Can only generate invoice for paid orders
      if (order.paymentStatus !== PaymentStatus.CAPTURED) {
        res.status(409).json({
          ok: false,
          error: {
            code: "INVALID_STATE",
            message: "Invoice available only for paid orders",
          },
        });
        return;
      }

      // Generate invoice number and date
      const invoiceNumber = `INV-${order.orderNumber}`;
      const invoiceDate = new Date(order.createdAt);

      // All monetary values are stored in paise — render them as rupees.
      const money = (paise: number) => `INR ${(paise / 100).toFixed(2)}`;

      // Use PDFKit to generate the invoice
      const PDFDocument = require("pdfkit");
      const doc = new PDFDocument({ margin: 50 });

      // Set response headers
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${invoiceNumber}.pdf"`);

      doc.pipe(res);

      // Header
      doc.fontSize(20).font("Helvetica-Bold").text("INVOICE", { align: "center" });
      doc.moveDown(0.5);

      // Invoice details
      doc.fontSize(10).font("Helvetica");
      doc.text(`Invoice Number: ${invoiceNumber}`);
      doc.text(
        `Order Date: ${invoiceDate.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}`
      );
      doc.text(`Order Number: ${order.orderNumber}`);
      doc.moveDown();

      // Bill to section
      doc.fontSize(12).font("Helvetica-Bold").text("BILL TO:");
      doc.fontSize(10).font("Helvetica");
      doc.text(order.shippingAddress.fullName);
      doc.text(order.shippingAddress.addressLine1);
      if (order.shippingAddress.addressLine2) {
        doc.text(order.shippingAddress.addressLine2);
      }
      doc.text(
        `${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}`
      );
      doc.text(order.shippingAddress.country || "IN");
      doc.moveDown();

      // Items table
      doc.fontSize(12).font("Helvetica-Bold").text("ORDER ITEMS");
      doc.moveDown(0.5);

      const tableTop = doc.y;
      const col1X = 50;
      const col2X = 300;
      const col3X = 400;
      const col4X = 500;

      // Table header
      doc.fontSize(10).font("Helvetica-Bold");
      doc.text("Product", col1X, tableTop);
      doc.text("Qty", col2X, tableTop);
      doc.text("Unit Price", col3X, tableTop);
      doc.text("Total", col4X, tableTop);

      doc
        .moveTo(col1X, tableTop + 15)
        .lineTo(550, tableTop + 15)
        .stroke();

      // Table rows
      let currentY = tableTop + 25;
      doc.fontSize(9).font("Helvetica");

      for (const item of order.items) {
        const productName =
          item.variantLabel && item.variantLabel !== "DEFAULT"
            ? `${item.productName} (${item.variantLabel})`
            : item.productName;

        doc.text(productName, col1X, currentY, { width: 200, ellipsis: true });
        doc.text(String(item.quantity), col2X, currentY);
        doc.text(money(item.unitPrice), col3X, currentY);
        doc.text(money(item.lineTotal), col4X, currentY);

        currentY += 20;
      }

      doc.moveTo(col1X, currentY).lineTo(550, currentY).stroke();
      currentY += 15;

      // Summary
      doc.fontSize(10).font("Helvetica");
      doc.text("Subtotal:", col3X, currentY);
      doc.text(
        money(order.totalAmount - order.taxAmount - (order.shippingAmount || 0)),
        col4X,
        currentY
      );

      currentY += 15;
      doc.text("Tax (GST):", col3X, currentY);
      doc.text(money(order.taxAmount), col4X, currentY);

      if (order.shippingAmount && order.shippingAmount > 0) {
        currentY += 15;
        doc.text("Shipping:", col3X, currentY);
        doc.text(money(order.shippingAmount), col4X, currentY);
      }

      currentY += 20;
      doc.fontSize(12).font("Helvetica-Bold");
      doc.text("TOTAL:", col3X, currentY);
      doc.text(money(order.totalAmount), col4X, currentY);

      // Footer
      doc.moveDown(2);
      doc.fontSize(9).font("Helvetica").text("Thank you for your purchase!", { align: "center" });
      doc.text("For support, contact: support@powermysport.com", {
        align: "center",
      });

      doc.end();
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
}
