/**
 * Canonical Indian states + union territories for the address dropdowns.
 *
 * Re-exported from `@/lib/indianStates` rather than kept as a second copy: every
 * endpoint that takes a state rejects names the server doesn't recognise, so
 * there is only ever one correct list and it should only ever be edited in one
 * place.
 */
import { INDIAN_STATES_AND_UTS } from "@/lib/indianStates";

// Widened to `string[]` deliberately: the address forms test `includes()` against
// a free-text value, which a readonly tuple of literal types rejects.
export const INDIAN_STATES: string[] = [...INDIAN_STATES_AND_UTS];
