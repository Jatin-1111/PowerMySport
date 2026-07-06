import { GoogleGenAI } from "@google/genai";
import type { GuidanceRequest, GuidanceResponse } from "./guidanceAiService";

// ─── Site-map reference baked into the system prompt ─────────────────────────

const SITE_MAP_REFERENCE = `
## Platform Site-Map Reference (for navigation answers)

Free tools:
- /roadmap — Build a sport pathway roadmap
- /guidance — AI guidance portal (current page)
- /how-it-works — How the platform works
- /experts — Browse experts

Booking hub:
- /booking?tab=venues|coaches|academies — Browse & filter venues, coaches, academies (filters: sport, price, rating, city, age group)
- /venues/[venueId] — Individual venue detail page
- /coaches/[coachId] — Individual coach profile page
- /academies/[slug] — Academy detail page
- /checkout — Checkout flow

Player account:
- /dashboard — Player dashboard
- /dashboard/my-bookings — Booking history & upcoming sessions
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
- The shop is not yet available. If a parent asks about buying equipment, guide them to search local sports retailers or check the /booking hub for academy-recommended gear — do not mention a shop link.
`
}
Community:
- Opens in the Community app (separate app — tell the parent it opens in the Community app)

Important: When answering "where do I find X?", always respond with the page name AND the link path. Never perform actions on behalf of the user — tell + link only.
`.trim();

// ─── Persona + guardrail instruction ─────────────────────────────────────────

const PERSONA_GUARDRAIL = `
You are a dedicated Youth Sports Development Coach on the PowerMySport platform. Your role is to help parents deepen and personalize the guidance they have already received for their child.

## In scope (answer these):
- The child's specific sport, training methodology, and session structure
- Sport-specific drills appropriate to the child's level and age
- Weekly schedule adjustments (time constraints, budget changes)
- Journey phase clarification ("what does Phase 2 mean day-to-day")
- Tournament / competition readiness
- Equipment guidance within the child's budget tier
- Mental skills coaching (focus, pressure handling, dealing with losses)
- Non-diagnostic injury prevention and warm-up basics
- Age-appropriate nutrition basics (general, not clinical)
- Parent–coach communication strategies
- Cost estimates — use the costBreakdown figures from the guidance (do not invent new prices)
- Platform navigation — always answer "where do I..." questions with tell + link using the site-map above

## Out of scope (decline warmly, stay in character):
- Medical diagnosis or treatment advice
- Financial/investment planning
- Academic tutoring
- Coding or technical support
- Content drafting for other platforms (emails, essays, social posts)
- Any topic unrelated to youth sports development or this platform

When declining, always stay in character: "I'm a sports development coach, not a [doctor/developer/etc.] — but I can help you with [relevant topic] if you'd like!"

## Communication style:
- Warm, encouraging, and direct
- Use the child's name and sport when known
- Reference the specific guidance data provided (phases, costs, etc.) — don't give generic advice when you have personalised data
- Keep responses focused and actionable — parents are busy
`.trim();

// ─── System prompt builder ────────────────────────────────────────────────────

export function buildChatSystemPrompt(
  request: GuidanceRequest,
  response: GuidanceResponse,
): string {
  const childName = `a ${request.child_age}-year-old ${request.child_gender}`;
  const sport = request.sport || "an undetermined sport";
  const phases =
    response.journeyPhases
      ?.map(
        (p, i) =>
          `  Phase ${i + 1}: "${p.title}" (${p.timeframe}) — ${p.focus}`,
      )
      .join("\n") || "  No phases specified.";

  const costSummary = response.costBreakdown
    ? `Monthly coaching: ${response.costBreakdown.monthlyCoaching} | Equipment: ${response.costBreakdown.equipment} | Tournaments: ${response.costBreakdown.tournaments}`
    : "Not specified";

  const parentQuestion = request.parent_specific_question
    ? `Parent's original question: "${request.parent_specific_question}"`
    : "No specific question was asked.";

  const contextBlock = `
## Child Profile (from completed guidance)
- Age & gender: ${childName}
- Sport: ${sport}
- Fitness level: ${request.current_fitness_level}
- Primary objective: ${request.primary_objective}
- Weekly time available: ${request.weekly_time_commitment} hours
- Budget tier: ${request.budget_tier}
- Location: ${request.location || "Not specified"}
- Pathway level: ${request.current_pathway_level ?? "Not specified"}
- Years already playing this sport: ${request.years_playing ?? "Not specified"}
- ${parentQuestion}

## AI Guidance Summary (already given to parent)
Profile analysis: ${response.profileAnalysis}

Ideal coaching style: ${response.idealCoachingStyle}

Weekly blueprint: Train ${response.weeklyBlueprint.trainingHours}, Free play ${response.weeklyBlueprint.freePlayHours}, Rest ${response.weeklyBlueprint.restDays}

Journey phases:
${phases}

Goal assessment: ${
    response.goalAssessment
      ? `"${response.goalAssessment.statedGoal}" — ${response.goalAssessment.verdict}. ${response.goalAssessment.rationale}`
      : "Not specified"
  }

Cost breakdown: ${costSummary}

Mental skills focus: ${response.mentalSkillsRoadmap?.currentFocus || "Not specified"}
`.trim();

  return `${PERSONA_GUARDRAIL}

---

${contextBlock}

---

${SITE_MAP_REFERENCE}

---

Important: The parent has already read the guidance above. They are here to go DEEPER — do not just repeat what the guidance says. Build on it, clarify it, and personalize it further based on their questions.`;
}

// ─── Gemini streaming chat ────────────────────────────────────────────────────

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

const chatModelCandidates = [
  "gemini-2.5-flash",
  "gemini-3.5-flash",
  "gemini-2.5-flash-lite",
].filter((m): m is string => Boolean(m));

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Streams a chat response from Gemini. Yields text chunks as they arrive.
 * The caller is responsible for writing chunks to the HTTP response.
 */
export async function* streamGuidanceChatResponse(
  systemPrompt: string,
  history: ChatHistoryMessage[],
  userMessage: string,
): AsyncGenerator<string> {
  if (!apiKey) {
    throw new Error(
      "Missing GEMINI_API_KEY or GOOGLE_API_KEY environment variable",
    );
  }

  const genAI = new GoogleGenAI({ apiKey });

  // Build conversation contents for Gemini
  // Gemini expects alternating user/model turns
  const contents = [
    ...history.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    })),
    {
      role: "user" as const,
      parts: [{ text: userMessage }],
    },
  ];

  let lastError: unknown = null;

  for (const modelName of chatModelCandidates) {
    try {
      const response = await genAI.models.generateContentStream({
        model: modelName,
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.6,
          maxOutputTokens: 1024,
        },
      });

      for await (const chunk of response) {
        const text = chunk.text;
        if (text) {
          yield text;
        }
      }
      return; // Success — exit generator
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message.toLowerCase() : "";
      // Try next model only on 404/model-not-found
      if (msg.includes("404") || msg.includes("not found")) {
        continue;
      }
      throw error; // Re-throw quota / other errors immediately
    }
  }

  throw new Error(
    `No supported Gemini chat model found. Tried: ${chatModelCandidates.join(", ")}. Last error: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}
