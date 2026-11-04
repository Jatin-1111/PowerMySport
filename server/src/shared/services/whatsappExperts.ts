import {
  getExpertById,
  getExpertOpenSlots,
  listActiveExperts,
} from "../../client/services/ExpertsService/discovery";
import { brief } from "./parentAccountLookups";
import { siteUrl } from "./whatsappHandoff";
import { formatIstDateTime } from "./whatsappTemplates";

/**
 * Reading one expert for the assistant, and handing the parent to the website to book.
 *
 * Everything here is the expert's public listing, the same fields the website shows to anyone:
 * no email, no phone, no in-person address, no payout details. The assistant can never book,
 * hold a slot or take a payment; the profile link is where that happens.
 */

const MAX_SLOTS = 5;
const MAX_OPTIONS = 3;
/** A real id looks like this; anything else is treated as a name. */
const LOOKS_LIKE_ID = /^[a-f0-9]{24}$/i;

export const expertProfileUrl = (id: string): string => `${siteUrl()}/experts/${id}`;

interface PublicExpert {
  id: string;
  name: string;
  bio?: string;
  sports: string[];
  expertise: string[];
  achievements?: string;
  sessionFee: number;
  sessionMode: "ONLINE" | "IN_PERSON" | "BOTH";
  sessionDurationMinutes: number;
  city?: string;
  languages: string[];
  rating: number;
  reviewCount: number;
}

const modeWords = (mode: PublicExpert["sessionMode"]): string =>
  mode === "ONLINE" ? "online" : mode === "IN_PERSON" ? "in person" : "online or in person";

/** The expert the parent means, or what to ask to settle it. */
async function findExpert(
  query: string,
  sport: string | undefined
): Promise<{ expert: PublicExpert } | { reply: Record<string, unknown> }> {
  if (LOOKS_LIKE_ID.test(query.trim())) {
    // An id passed back from a search result. A bad or inactive one is simply not found.
    const expert = await getExpertById(query.trim()).catch(() => null);
    if (expert) return { expert: expert as unknown as PublicExpert };
  } else {
    const { data } = await listActiveExperts({
      search: query,
      ...(sport ? { sport } : {}),
      limit: 8,
    });
    const experts = data as unknown as PublicExpert[];

    // The search also reads bios and cities, so prefer the experts whose name matches.
    const wanted = query.trim().toLowerCase();
    const byName = experts.filter((expert) => expert.name.toLowerCase().includes(wanted));
    const pool = byName.length > 0 ? byName : experts;

    if (pool.length === 1) return { expert: pool[0]! };
    if (pool.length > 1) {
      return {
        reply: {
          found: false,
          reason: "which_expert",
          options: pool.slice(0, MAX_OPTIONS).map((expert) => ({
            name: expert.name,
            city: expert.city,
            sports: expert.sports,
            profileUrl: expertProfileUrl(expert.id),
          })),
          instruction:
            "More than one expert matches. Ask the parent which one they mean, naming them with their city and sport, and give each profile link on its own line. Do not guess.",
        },
      };
    }
  }

  return {
    reply: {
      found: false,
      reason: "not_found",
      instruction: `No expert matches that. Say so, and offer to search by sport or city, or point to ${siteUrl()}/experts.`,
    },
  };
}

export async function getExpertDetailsForChat(args: Record<string, unknown>): Promise<unknown> {
  const query = typeof args.expert === "string" ? args.expert.trim().slice(0, 100) : "";
  if (!query) {
    return {
      found: false,
      reason: "which_expert",
      instruction: "Ask which expert they mean, by name, or offer to search by sport or city.",
    };
  }

  const found = await findExpert(query, typeof args.sport === "string" ? args.sport : undefined);
  if ("reply" in found) return found.reply;
  const { expert } = found;

  // Open now, not held: the website is where a slot is actually taken.
  const slots = await getExpertOpenSlots(expert.id).catch(() => []);
  const nextOpenSlots = slots.slice(0, MAX_SLOTS).map((slot) => formatIstDateTime(slot.start));

  const profileUrl = expertProfileUrl(expert.id);
  return {
    found: true,
    expert: {
      name: expert.name,
      ...(expert.city ? { city: expert.city } : {}),
      sports: expert.sports,
      expertise: expert.expertise.slice(0, 6),
      ...(brief(expert.bio, 500) ? { about: brief(expert.bio, 500) } : {}),
      ...(brief(expert.achievements, 250) ? { achievements: brief(expert.achievements, 250) } : {}),
      feePerSessionRupees: expert.sessionFee,
      sessionMinutes: expert.sessionDurationMinutes,
      mode: modeWords(expert.sessionMode),
      languages: expert.languages,
      rating: expert.rating,
      reviewCount: expert.reviewCount,
    },
    nextOpenSlots,
    ...(nextOpenSlots.length === 0
      ? { slotsNote: "No open slots in the next two weeks. The profile may show more." }
      : {}),
    profileUrl,
    instruction:
      "Summarise the expert in a few short lines: who they are, what they help with, the fee as ₹ per session with the session length, online or in person, and the rating only if there are reviews. List the next open times if any, in Indian time, and say they are open now but not held, so they can be taken before the parent books. Give the profile link on its own line and say booking and payment happen there: you cannot book, hold a slot or take a payment. This is a one-to-one consultation, not regular coaching.",
  };
}
