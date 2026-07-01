# Guidance Companion — AI Coach Chatbot

**Filename justification (two words): Guidance Companion** — this isn't a generic support chatbot; it's a companion that continues the one conversation a parent already started on the Roadmap and Guidance pages, carried into a chat surface.

---

## 1. Goal

Give a parent who has just received AI guidance a way to **go deeper on that specific guidance** through conversation — without ever feeling like they've left the coach who just built their roadmap and switched to a different tool.

Success criteria:
1. The chat opens pre-loaded with the child's context — no re-explaining anything already answered in guidance.
2. It answers sport/training/platform questions accurately and declines everything else gracefully, via persona rather than keyword filtering.
3. A guest can complete the entire roadmap → guidance flow unauthenticated, exactly as today. The moment they try to chat, they see a login-required modal (not a surprise redirect), and logging in drops them right back into the open chat with context intact.
4. Conversations persist — a parent can close the tab and resume later.

---

## 2. The connected journey

```
/roadmap  →  /guidance  →  [Chat with Coach drawer]
 (builds)     (interprets)   (personalizes further)
```

- Roadmap output flows into Guidance as pre-filled context (already true today).
- Guidance output flows into the chatbot as pre-filled context (the new piece).
- The chatbot's first message is never blank — it opens already knowing the child's name, sport, phase, and the parent's original question.
- The "Chat with Coach" trigger sits where the guidance results end, styled as the natural next step in the existing Journey UI — not a floating generic widget bolted on.

---

## 3. Feature set

### v1 — core capabilities

**Guidance refinement:**
- Explain/expand any part of the generated guidance
- Sport-specific drills & session structuring appropriate to level
- Weekly schedule re-planning when real-life constraints change (less time, different budget)
- Milestone clarification ("what does this actually mean day-to-day")
- Tournament/competition readiness discussion
- Equipment guidance scoped to budget tier
- Mental-skills coaching talk (focus, pressure, handling losses)
- Non-diagnostic injury-prevention & warm-up basics
- Nutrition basics (general, age-appropriate — not clinical)
- Parent-coach communication tips
- Price-band guidance sourced from the guidance's own `costBreakdown` (not live catalog queries)

**Site-aware navigation:**
- Chatbot carries a maintained site-map reference and always answers "where do I..." with **tell + link** — it never performs the action itself (no in-chat booking, no in-chat saving).

### Deferred (real features, wrong milestone)

| Feature | Why deferred |
|---|---|
| Multi-child profile switching in one chat | Needs a profile-picker UI; ship single-submission context first |
| Multilingual (Hindi/regional) | Prompt-layer toggle, bolt on later without re-architecting |
| Live coach/venue availability lookup | Real-time booking UI already does this correctly; redirect there |
| In-chat booking actions | Tell+link only, by design |
| Progress-aware proactive nudges | Belongs to the notifications system, not a chat capability |

### Rejected (not just later — no)

| Feature | Why rejected |
|---|---|
| Sentiment detection → human handoff | No human support queue exists for guidance chat; would be dead code |
| Drafting community posts / emails / essays | Undermines the "no solve-this-for-me" guardrail — if it drafts one kind of content for another surface, the boundary erodes |
| Anonymized cross-user benchmarking | New aggregation + privacy review for a nice-to-have insight; disproportionate |
| Voice input | No signal this audience needs it; adds permission friction for unclear payoff |
| Chat export to PDF | Guidance itself has no export yet — solving it for chat alone is inconsistent |

---

## 4. Guardrails

Persona-based, not keyword-filtered. The system prompt frames the bot as **a sports development coach**:

- ✅ In scope: the child's sport, training, mental game, nutrition basics, equipment, injury-prevention basics, parent-coach relationship, platform navigation
- 🚫 Out of scope, redirected warmly: coding/tech help, medical diagnosis, financial/investment advice, academic help, general knowledge unrelated to sport, content generation for other purposes, any other child's/sport's guidance not tied to this submission

Rejecting via persona ("I'm a sports coach, not a developer — happy to help with [sport] training instead") lets edge cases degrade gracefully instead of erroring.

---

## 5. Site-map reference (baked into system prompt, maintained as a constant)

- **Free tools:** `/roadmap`, `/guidance` (current page), `/how-it-works`, `/experts`
- **Booking hub:** `/booking?tab=venues|coaches|academies` with filters (sport, price, rating, city, age group). Detail pages: `/venues/[venueId]`, `/coaches/[coachId]`, `/academies/[slug]`. Checkout: `/checkout`.
- **Player account:** `/dashboard`, `/dashboard/my-bookings`, `/dashboard/wallet`, `/saved`, `/notifications`, `/settings`
- **Shop:** `/shop`, `/shop/cart`, `/shop/orders`, `/shop/wishlist`
- **Community:** external app (`getCommunityAppUrl()`) — bot should say "opens in the Community app" so expectations are set correctly.
- **Role dashboards** (coach/academy/venue-lister) excluded from default context unless the logged-in account role warrants it.

---

## 6. Context inherited from guidance

From `GuidanceSubmission.request`: `child_age`, `child_gender`, `current_fitness_level`, `sport`, `primary_objective`, `weekly_time_commitment`, `budget_tier`, `location`, `current_pathway_level`, `parent_specific_question`.

From `GuidanceSubmission.response`: `profileAnalysis`, `idealCoachingStyle`, `weeklyBlueprint`, `journeyPhases[]`, `costBreakdown`, `mentalSkillsRoadmap`.

---

## 7. Guest → login handoff (modal, not redirect)

- Guest completes guidance normally (unauthenticated, works today).
- Guest clicks **"Chat with Coach"** → client detects no auth token → opens a **`LoginRequiredModal`** in place: *"Log in to chat with your coach about [child]'s guidance"* with **Log In** / **Sign Up** buttons.
- Buttons navigate to `/login?redirect=/guidance?submissionId={id}&openChat=1` (or `/register?...`) — the modal is the gate; the actual auth still happens on the existing full pages, so no embedded login form needs to be built.
- After successful login/register, the `redirect` param sends the user back to guidance with the chat drawer auto-opening — context intact.
- **Ownership claim:** if the guidance submission was created as a guest (`userId` is null), the first authenticated chat request against that `submissionId` backfills `submission.userId = req.user.id`. If the submission already belongs to a *different* user, the chat request is rejected (403).

**Pre-flight check before coding:** `guidanceRoutes.ts` currently shows `authMiddleware` (hard 401) on `POST /guidance`, which conflicts with guests submitting guidance today. Confirm the actual guest-submission mechanism (separate route, optional-auth variant, or client-side-only path) before wiring the ownership-claim logic — this is the first thing to verify when implementation starts.

---

## 8. Data model

New collection `GuidanceChatSession` (not embedded in `GuidanceSubmission` — keeps that document lean):

- `submissionId` (ref `GuidanceSubmission`, required)
- `userId` (ref `User`, required — chat is always authenticated)
- `messages[]`: `{ role: "user" | "assistant", content, createdAt }`
- `dailyMessageCount`, `dailyResetAt`
- `totalMessageCount`
- `createdAt` / `updatedAt`

Unique compound index on `(submissionId, userId)` — reopening the drawer always resumes the same thread.

---

## 9. Backend API surface

- `POST /api/guidance/:submissionId/chat` — send a message, streamed response
  - Loads or lazily creates the `GuidanceChatSession`
  - Enforces ownership rule (§7)
  - Enforces rate limits (§10)
  - Builds system prompt from the submission's `request` + `response` fields + site-map + guardrails
  - Appends both turns to `messages[]`
- `GET /api/guidance/:submissionId/chat` — fetch existing session, for resuming on page load
- Reuses existing `authMiddleware` — no new auth pattern beyond the modal/redirect handoff in §7.

---

## 10. Rate limiting (two layers, reusing existing infra)

Reuses the existing Redis-backed `express-rate-limit` store (`createRedisRateLimitStore`) already used elsewhere in the codebase.

| Layer | Limit | Why |
|---|---|---|
| **Burst** (route-level, Redis store) | 10 requests/minute per user | Blocks scripted abuse; generous for real typing pace |
| **Daily cap** (stored on session doc) | 30 user messages/day per submission | Covers ~2 substantial real conversations; caps runaway Gemini cost |
| **Lifetime cap** (stored on session doc) | 150 user messages per submission | A guidance chat should naturally wind down; past this, the UI nudges toward generating a fresh roadmap — good product behavior, not just a limit |

Daily counter resets via `dailyResetAt` on the session document — no new Mongo model required.

---

## 11. AI layer — Gemini

- Reuses the same `GEMINI_API_KEY` / model-fallback pattern already in `guidanceAiService.ts` (`gemini-3.1-flash-lite` → `gemini-2.5` → etc.).
- New `guidanceChatService.ts` builds the system prompt per request from: submission `request` + `response` fields + site-map reference + persona/guardrail instructions.
- Streams tokens back to the client for a live-typing feel.

---

## 12. Frontend

- `GuidanceChatDrawer` — slide-in from the right on the guidance results page; guidance stays visible underneath for reference.
- Trigger: sticky **"Chat with Coach"** button, appears once results render.
- Auth-gated per §7 (modal, not redirect).
- On mount, calls `GET /chat` to resume history; if empty, server sends the pre-seeded opening message as the first assistant turn.
- Quick-reply chips for common asks ("Explain this phase", "Suggest drills", "Where do I find a coach?").
- Streamed rendering, consistent with the existing `AnimatePresence`/motion conventions already on the guidance page.

---

## 13. Build order

1. Confirm the guest-guidance-submission mechanism (§7 pre-flight check) — unblocks everything else
2. `GuidanceChatSession` model + ownership-claim logic
3. `guidanceChatService.ts` (Gemini + system prompt builder, including site-map block)
4. `POST`/`GET /chat` routes + rate-limit wiring
5. Login/register `redirect` param support (new, cross-cutting — touches auth pages)
6. `LoginRequiredModal` + trigger button wiring
7. `GuidanceChatDrawer` + streaming UI
8. End-to-end pass: guest → guidance → guest tries chat → modal → login → lands back in open chat with context intact
