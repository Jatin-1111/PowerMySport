"use client";

import { consoleHomeFor } from "@/flow/policy";
import { queryKeys } from "@/lib/query/keys";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { requestParentalConsent } from "@/modules/player/store/parentalConsentStore";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  handoffApi,
  problemFrom,
  type ClaimResult,
  type HandoffChild,
} from "../services/handoffApi";
import { forgetToken, recalledToken, rememberToken } from "../utils/handoffToken";
import { buildClaim, type ChildDraft } from "../utils/review";

export type HandoffState =
  | { kind: "checking" }
  | { kind: "no-link" }
  | { kind: "loading" }
  | { kind: "problem"; message: string }
  | { kind: "ready"; children: HandoffChild[] };

/** Who is looking, in the three states the access policy uses, plus a role that cannot add children. */
export type HandoffSession = "unknown" | "anonymous" | "parent" | "not-a-parent";

const START = "/start";

const never = () => () => undefined;
/** False while the server renders and during hydration, true once the browser has taken over. */
const useMounted = () =>
  useSyncExternalStore(
    never,
    () => true,
    () => false
  );
/** The token kept for this visit. Read from storage on the client, absent on the server. */
const useKeptToken = () => useSyncExternalStore(never, recalledToken, () => null);

/**
 * The review page's behaviour: take the link's token off the address, show what was kept, and
 * turn the parent's confirmation into profiles.
 */
export function useHandoff() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);
  const mounted = useMounted();

  const urlToken = searchParams.get("t");
  const kept = useKeptToken();
  const token = urlToken ?? kept;

  // Out of the address bar, history and any referrer, as soon as it is held. The token is
  // already in `urlToken` for this render and in storage for every later one.
  useEffect(() => {
    if (!urlToken) return;
    rememberToken(urlToken);
    router.replace(START);
  }, [urlToken, router]);

  const preview = useQuery({
    queryKey: queryKeys.whatsappHandoff.preview(token ?? ""),
    queryFn: () => handoffApi.preview(token!),
    enabled: Boolean(token),
    retry: false,
    // The notes do not change while the parent reads them; a confirmation refetches by hand.
    staleTime: Infinity,
  });

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ClaimResult | null>(null);
  // A link that stopped working while the parent was confirming.
  const [linkProblem, setLinkProblem] = useState<string | null>(null);

  const state: HandoffState = !mounted
    ? { kind: "checking" }
    : linkProblem
      ? { kind: "problem", message: linkProblem }
      : !token
        ? { kind: "no-link" }
        : preview.isPending
          ? { kind: "loading" }
          : preview.isError
            ? { kind: "problem", message: problemFrom(preview.error).message }
            : { kind: "ready", children: preview.data };

  const session: HandoffSession = !hydrated
    ? "unknown"
    : !user
      ? "anonymous"
      : user.role === "Parent"
        ? "parent"
        : "not-a-parent";

  const { refetch } = preview;
  const notes = preview.data;
  const submit = useCallback(
    async (drafts: Record<string, ChildDraft>) => {
      if (!notes || linkProblem || !token || !user || submitting) return;
      const built = buildClaim(notes, drafts);
      if (!built.ok) {
        setErrors(built.errors);
        return;
      }
      setErrors({});
      setSubmitting(true);
      try {
        let consentGiven = user.parentalConsentCurrent === true;
        if (!consentGiven) {
          consentGiven = await requestParentalConsent();
          if (!consentGiven) {
            toast.error("We need your agreement to the Parental Consent policy to add a child.");
            return;
          }
        }

        const attempt = (withConsent: boolean) =>
          handoffApi.claim(token, built.items, withConsent || undefined);
        let outcome: ClaimResult;
        try {
          outcome = await attempt(user.parentalConsentCurrent !== true);
        } catch (error) {
          // The server's record of consent can be older than this tab's: ask once, then retry.
          if (problemFrom(error).status !== 428 || !(await requestParentalConsent())) throw error;
          outcome = await attempt(true);
        }

        useAuthStore.setState({ user: { ...user, parentalConsentCurrent: true } });
        setResult(outcome);

        if (outcome.created.length > 0) {
          toast.success(
            outcome.created.length === 1
              ? `${outcome.created[0]} has been added to your profile.`
              : `${outcome.created.length} children have been added to your profile.`
          );
        }
        if (outcome.failed.length === 0 && outcome.remaining === 0) {
          forgetToken();
          router.push(consoleHomeFor(user.role));
        } else {
          // Something is left or went wrong: show it and let the parent carry on.
          await refetch();
        }
      } catch (error) {
        const problem = problemFrom(error);
        // A link that has stopped working is a different page from a form that needs fixing.
        if (problem.status === 400 || problem.status === 410) {
          setLinkProblem(problem.message);
        } else {
          toast.error(problem.message);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [notes, linkProblem, token, user, submitting, router, refetch]
  );

  return { state, session, user, submitting, errors, result, submit };
}
