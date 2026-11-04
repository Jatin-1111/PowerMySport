/**
 * PowerMySport's own legal/tax identity, printed on every tax invoice we issue
 * (bookings, enrolments, expert sessions). GSTIN is overridable via env since
 * it's a real regulatory identifier that may need to change without a deploy.
 */
export const COMPANY_LEGAL_NAME = "PowerMySport Private Limited";

export const COMPANY_GSTIN = process.env.COMPANY_GSTIN || "03AAQCP8236N1ZS";

export const COMPANY_CIN = "U93120PB2026PTC067587";

export const COMPANY_ADDRESS_LINES = [
  "HPE-R1-D104, DLF Hyde Park Estate, Mullanpur,",
  "Mullanpur, Mohali - 140901, Punjab, India",
];

export const COMPANY_STATE = "Punjab";

export const COMPANY_SUPPORT_EMAIL = "support@powermysport.com";

export const COMPANY_WEBSITE = "powermysport.com";

export const COMPANY_DISPLAY_NAME = "PowerMySport";

export const COMPANY_TAGLINE = "Guiding every sporting journey";
