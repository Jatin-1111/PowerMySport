import { SPORT_LABEL } from "@/modules/pathway/config/tournamentDisplay";

import type { Opportunity } from "../services/opportunities";
import { whereLabel } from "./format";

// ─── Does this entry fit this child? ─────────────────────────────────────
//
// What a parent tells us is small: age, sport, gender, state. Only rules that
// are stored as numbers or names can be compared against that, so only those
// are ever ticked or crossed. Marks, income and sporting level are written in
// the scheme's own words ("at least 70% over the past two years"), and
// guessing whether a child meets them would be worse than not checking: they
// are listed as "check yourself", with the rule as published.
//
// So a "fits" verdict means every rule we hold in structured form passes and
// there is nothing left that needs a human; anything else that did not fail
// is "check the details". It never says "fits" on a guess, and an entry whose
// rules we have not recorded is never "fits" either: no rules on file is not
// the same as no rules.

export interface ChildProfile {
  age: number | null;
  sport: string | null;
  gender: "boy" | "girl" | null;
  state: string | null;
}

export const EMPTY_PROFILE: ChildProfile = { age: null, sport: null, gender: null, state: null };

export const hasProfile = (profile: ChildProfile): boolean =>
  profile.age !== null || !!profile.sport || !!profile.gender || !!profile.state;

/**
 * pass:    the child meets it.
 * fail:    the child does not.
 * manual:  a rule only a person can judge; shown as published.
 * unknown: we could check it, but have not been told enough about the child.
 */
export type CheckState = "pass" | "fail" | "manual" | "unknown";

export interface EligibilityCheck {
  key: "sport" | "age" | "gender" | "where" | "level" | "academic" | "income" | "rules";
  label: string;
  state: CheckState;
  detail: string;
}

export type Verdict = "fits" | "check" | "no";

type Matchable = Pick<Opportunity, "sports" | "allSports" | "geography" | "eligibility">;

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function checkOpportunity(
  opportunity: Matchable,
  profile: ChildProfile
): { checks: EligibilityCheck[]; verdict: Verdict | null } {
  const checks: EligibilityCheck[] = [];
  const e = opportunity.eligibility;

  // Sport
  const sportNames = opportunity.sports.map((slug) => SPORT_LABEL[slug] ?? slug);
  const sportDetail = opportunity.allSports
    ? "Open to every sport"
    : sportNames.length > 0
      ? `For ${sportNames.join(", ")}`
      : "Sport not specified";
  checks.push({
    key: "sport",
    label: "Sport",
    detail: sportDetail,
    state: opportunity.allSports
      ? "pass"
      : !profile.sport
        ? "unknown"
        : opportunity.sports.includes(profile.sport)
          ? "pass"
          : "fail",
  });

  // Age: numbers can be compared, a note ("grades 7-12") cannot.
  if (e && (e.ageMin !== undefined || e.ageMax !== undefined)) {
    const range =
      e.ageMin !== undefined && e.ageMax !== undefined
        ? `Ages ${e.ageMin} to ${e.ageMax}`
        : e.ageMax !== undefined
          ? `Up to age ${e.ageMax}`
          : `Age ${e.ageMin} and over`;
    const detail = [range, e.ageNote].filter(Boolean).join(". ");
    const tooYoung = profile.age !== null && e.ageMin !== undefined && profile.age < e.ageMin;
    const tooOld = profile.age !== null && e.ageMax !== undefined && profile.age > e.ageMax;
    checks.push({
      key: "age",
      label: "Age",
      detail,
      state: profile.age === null ? "unknown" : tooYoung || tooOld ? "fail" : "pass",
    });
  } else if (e?.ageNote) {
    checks.push({ key: "age", label: "Age", detail: e.ageNote, state: "manual" });
  }

  // Gender: only a restriction is worth a row.
  if (e?.gender === "female" || e?.gender === "male") {
    const wanted = e.gender === "female" ? "girl" : "boy";
    checks.push({
      key: "gender",
      label: "Who",
      detail: e.gender === "female" ? "Girls and women only" : "Boys and men only",
      state: !profile.gender ? "unknown" : profile.gender === wanted ? "pass" : "fail",
    });
  }

  // Where: a state scheme needs that state; a national one needs nothing.
  const geography = opportunity.geography;
  if (geography?.scope === "state") {
    checks.push({
      key: "where",
      label: "Where",
      detail: whereLabel(geography) ?? "One state",
      state: !profile.state
        ? "unknown"
        : geography.state && sameText(geography.state, profile.state)
          ? "pass"
          : "fail",
    });
  } else if (geography?.scope === "india") {
    checks.push({ key: "where", label: "Where", detail: "Open across India", state: "pass" });
  } else if (geography) {
    checks.push({
      key: "where",
      label: "Where",
      detail: whereLabel(geography) ?? "Check where it runs",
      state: "manual",
    });
  }

  // Rules written in the scheme's own words.
  if (e?.level)
    checks.push({ key: "level", label: "Sporting level", detail: e.level, state: "manual" });
  if (e?.academic)
    checks.push({ key: "academic", label: "Academic", detail: e.academic, state: "manual" });
  if (e?.income) checks.push({ key: "income", label: "Income", detail: e.income, state: "manual" });

  // Nothing recorded about who can apply: say so, and keep it from reading as "fits".
  const hasRules =
    e &&
    (e.ageMin !== undefined ||
      e.ageMax !== undefined ||
      e.ageNote ||
      e.gender === "female" ||
      e.gender === "male" ||
      e.level ||
      e.academic ||
      e.income);
  if (!hasRules) {
    checks.push({
      key: "rules",
      label: "Other rules",
      detail: "We have not recorded who can apply. Read the official source.",
      state: "manual",
    });
  }

  if (!hasProfile(profile)) return { checks, verdict: null };
  if (checks.some((check) => check.state === "fail")) return { checks, verdict: "no" };
  if (checks.every((check) => check.state === "pass")) return { checks, verdict: "fits" };
  return { checks, verdict: "check" };
}

export const VERDICT_LABELS: Record<Verdict, string> = {
  fits: "Fits your child",
  check: "Check the details",
  no: "Not a match",
};

/** Fits first, then ones to check, then the rest, so the useful ones lead. */
export const VERDICT_ORDER: Record<Verdict | "none", number> = {
  fits: 0,
  check: 1,
  none: 1,
  no: 2,
};
