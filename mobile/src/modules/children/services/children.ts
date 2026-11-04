import apiClient from "@lib/api/axios";
import type { ChildHistoryView, ChildGender } from "@powermysport/shared-types";

export interface Child {
  _id: string;
  name: string;
  dob?: string;
  age?: number;
  gender?: ChildGender;
  relation?: string;
  sportsFocus?: string[];
}

export interface AddChildPayload {
  name: string;
  /** YYYY-MM-DD */
  dob: string;
  gender?: ChildGender;
  relation?: string;
  /** Sent only when the parent ticked the consent box on this request. */
  parentalConsent?: boolean;
}

export const childrenApi = {
  list: async (): Promise<Child[]> => {
    const res = await apiClient.get("/auth/players");
    return res.data.data ?? [];
  },

  add: async (payload: AddChildPayload): Promise<Child> => {
    const res = await apiClient.post("/auth/dependents", payload);
    return res.data.data;
  },

  history: async (childId: string): Promise<ChildHistoryView> => {
    const res = await apiClient.get(`/child-history/${childId}`);
    return res.data.data;
  },

  /** True when the parent has already agreed to the current Parental Consent policy. */
  hasCurrentConsent: async (): Promise<boolean> => {
    const res = await apiClient.get("/auth/profile");
    return res.data.data?.parentalConsentCurrent === true;
  },
};

export const RELATIONS = [
  { value: "CHILD", label: "Child" },
  { value: "SON", label: "Son" },
  { value: "DAUGHTER", label: "Daughter" },
  { value: "NEPHEW", label: "Nephew" },
  { value: "NIECE", label: "Niece" },
  { value: "WARD", label: "Ward" },
  { value: "OTHER", label: "Other" },
] as const;

/** Whole years between a date of birth and today, or null for an unusable date. */
export function ageFromDob(dob?: string): number | null {
  if (!dob) return null;
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const beforeBirthday =
    now.getMonth() < born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() < born.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}
