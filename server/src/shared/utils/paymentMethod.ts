/**
 * Best-effort "Method" line for an invoice's payment-reference card, derived
 * from whatever PhonePe instrument info was captured on the transaction/session
 * document. Falls back to the bare gateway name when no instrument details
 * were stored (older records, or a status check that didn't return them).
 */
export const extractPhonePePaymentMethodLabel = (
  payloads:
    | { callbackPayload?: unknown; lastStatusPayload?: unknown }
    | null
    | undefined,
): string => {
  const pick = (payload: unknown): string | undefined => {
    if (!payload || typeof payload !== "object") return undefined;
    const details = (payload as Record<string, unknown>).paymentDetails;
    if (!Array.isArray(details) || !details.length) return undefined;
    const first = details[0];
    if (!first || typeof first !== "object") return undefined;
    const mode = (first as Record<string, unknown>).paymentMode;
    return typeof mode === "string" ? mode : undefined;
  };

  const modeRaw =
    pick(payloads?.lastStatusPayload) || pick(payloads?.callbackPayload);
  if (!modeRaw) return "PhonePe";

  const mode = modeRaw.toUpperCase();
  const label =
    mode === "UPI"
      ? "UPI"
      : mode === "CARD" || mode === "DEBIT_CARD" || mode === "CREDIT_CARD"
        ? "Card"
        : mode === "NET_BANKING" || mode === "NETBANKING"
          ? "Netbanking"
          : mode === "WALLET"
            ? "Wallet"
            : mode.replace(/_/g, " ");
  return `PhonePe · ${label}`;
};
