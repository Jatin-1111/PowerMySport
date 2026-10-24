import { Request, Response } from "express";

import { asyncHandler } from "../../middleware/asyncHandler";
import {
  enquirySummary,
  exportEnquiriesCsv,
  getEnquiry,
  listEnquiries,
  revealContact,
  updateEnquiryByTeam,
  type EnquiryFilters,
} from "../services/WhatsAppEnquiryAdminService";
import { recordAuditLog } from "../services/AuditLogService";

// The pilot's enquiries, for the admin screen. Audit entries name the action and the enquiry and
// never the parent's words or number.

const audit = (
  req: Request,
  action: string,
  metadata?: Record<string, unknown>,
  targetId?: string
) => {
  if (!req.user?.id) return;
  void recordAuditLog({
    adminId: req.user.id,
    adminEmail: req.user.email || "",
    action,
    targetType: "WhatsAppEnquiry",
    ...(targetId ? { targetId } : {}),
    ...(metadata ? { metadata } : {}),
  });
};

/** A query value that is one plain string; an array or object (`?q[$ne]=`) counts as absent. */
const str = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value : undefined;

const filtersFrom = (query: Request["query"]): EnquiryFilters => {
  const out: EnquiryFilters = {};
  for (const key of ["status", "sport", "assistance", "feedback", "from", "to", "q"] as const) {
    const value = str(query[key]);
    if (value) out[key] = value;
  }
  return out;
};

// GET /api/admin/whatsapp-pilot/enquiries
export const listWhatsAppEnquiries = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data = await listEnquiries(
      filtersFrom(req.query),
      Number(str(req.query.page)) || 1,
      Number(str(req.query.limit)) || 25
    );
    res.json({ success: true, data });
  }
);

// GET /api/admin/whatsapp-pilot/enquiries/summary
export const getWhatsAppEnquirySummary = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    res.json({ success: true, data: await enquirySummary() });
  }
);

// GET /api/admin/whatsapp-pilot/enquiries/export.csv
export const exportWhatsAppEnquiries = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const filters = filtersFrom(req.query);
    const { csv, count } = await exportEnquiriesCsv(filters);
    audit(req, "whatsapp-pilot.enquiries.export", { rows: count, filters: Object.keys(filters) });
    res
      .status(200)
      .type("text/csv; charset=utf-8")
      .set("Content-Disposition", 'attachment; filename="whatsapp-enquiries.csv"')
      // The BOM makes Excel read the rupee sign and Hindi text as UTF-8.
      .send(`﻿${csv}`);
  }
);

// GET /api/admin/whatsapp-pilot/enquiries/:id
export const getWhatsAppEnquiry = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    res.json({ success: true, data: await getEnquiry(String(req.params.id)) });
  }
);

// PATCH /api/admin/whatsapp-pilot/enquiries/:id   { followUpStatus?, teamNote? }
export const updateWhatsAppEnquiry = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    const data = await updateEnquiryByTeam(id, {
      followUpStatus: req.body?.followUpStatus,
      teamNote: req.body?.teamNote,
    });
    audit(
      req,
      "whatsapp-pilot.enquiries.update",
      {
        followUpStatus: req.body?.followUpStatus,
        noteChanged: req.body?.teamNote !== undefined,
      },
      id
    );
    res.json({ success: true, data });
  }
);

// POST /api/admin/whatsapp-pilot/enquiries/:id/reveal-contact
export const revealWhatsAppEnquiryContact = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    const phone = await revealContact(id);
    // Logged after the number is read, so the log never claims a reveal that failed.
    audit(req, "whatsapp-pilot.enquiries.reveal-contact", undefined, id);
    res.set("Cache-Control", "no-store").json({ success: true, data: { phone } });
  }
);
