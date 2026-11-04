/**
 * Roles a person may pick for themselves at sign-up, by any method (password or
 * Google). Privileged roles (Admin, Academy, ...) are provisioned through admin
 * flows and must never be self-selected. EXPERT is self-selectable but starts
 * inactive until an admin approves it.
 */
export const SELF_REGISTER_ROLES = ["Parent", "Player", "VenueLister", "Coach", "EXPERT"] as const;

export type SelfRegisterRole = (typeof SELF_REGISTER_ROLES)[number];

export const isSelfRegisterRole = (value: unknown): value is SelfRegisterRole =>
  typeof value === "string" && (SELF_REGISTER_ROLES as readonly string[]).includes(value);
