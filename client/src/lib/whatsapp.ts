// Shared WhatsApp lead-channel number and URL builder — used everywhere the
// app hands a parent off to a human for help instead of an in-app flow.
export const WA_NUMBER = "918968582443";

export function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`;
}
