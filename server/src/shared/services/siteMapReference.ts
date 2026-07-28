// ─── Site-map reference baked into AI chat system prompts ─────────────────────
// Shared by every chat feature that needs to answer "where do I find X?"
// (guidance chat, the general assistant, ...).

export const SITE_MAP_REFERENCE = `
## Platform Site-Map Reference (for navigation answers)

Free tools — these are FOUR SEPARATE tools, never use one name for another:
- /assessment/discover — Sport Assessment. For "which sport suits my child?" / "help me find a sport" — a quick quiz that recommends a sport based on age, personality, and physical traits. Use this for sport DISCOVERY, not /guidance.
- /sport-profile — Build Sport Profile. For a parent who ALREADY knows their child's sport and wants to build a profile around it (skips discovery, goes straight to personalization).
- /guidance — AI Guidance. Generates a full personalized DEVELOPMENT PLAN (training phases, weekly schedule, cost breakdown, coaching style) for a child's sport. Assumes the sport is already known or decided — this is NOT the tool for "which sport should my child play."
- /roadmap — Sport pathway/roadmap explorer. Browse the general levels/milestones for a specific KNOWN sport (not personalized to one child).
- /how-it-works — How the platform works
- /experts — Browse and book 1:1 expert consultations (verified sports experts, NOT the venue/coach/academy booking marketplace below). This is a separate, currently-live feature — search_experts tool results belong here.
${
  process.env.BOOKING_IS_LIVE === "true"
    ? `
Booking hub:
- /booking?tab=venues|coaches|academies — Browse & filter venues, coaches, academies (filters: sport, price, rating, city, age group)
- /venues/[venueId] — Individual venue detail page
- /coaches/[coachId] — Individual coach profile page
- /academies/[slug] — Academy detail page
- /checkout — Checkout flow
`
    : `
Booking hub:
- The venue/coach/academy booking marketplace is temporarily unavailable. Do NOT recommend, mention, or link to /booking, /venues, /coaches, or /academies pages, and do not bring up booking a venue/coach/academy as an option — act as if this feature isn't currently part of the platform. This does not affect /experts (1:1 expert consultations), which is unrelated and still live.
`
}
Player account:
- /dashboard — Player dashboard
- /dashboard/my-bookings — Booking history & upcoming sessions (viewing existing bookings only — do not use this to suggest making a new booking while the marketplace is down)
- /dashboard/wallet — Wallet & credits
- /saved — Saved venues / coaches
- /notifications — Notifications
- /settings — Account settings
${
  process.env.SHOP_IS_LIVE === "true"
    ? `
Shop:
- /shop — Sports equipment & gear shop
- /shop/cart — Cart
- /shop/orders — Order history
- /shop/wishlist — Wishlist
`
    : `
Shop:
- The shop is not yet available. If a parent asks about buying equipment, guide them to search local sports retailers instead — do not mention a shop link or the booking hub.
`
}
Community:
- Opens in the Community app (separate app — tell the parent it opens in the Community app)

Important: When answering "where do I find X?", always respond with the page name AND the link path. Never perform actions on behalf of the user — tell + link only.
`.trim();
