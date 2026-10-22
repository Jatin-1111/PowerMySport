"use client";

import { Button } from "@/modules/shared/ui/Button";
import Link from "next/link";
import { useState } from "react";
import { useHandoff } from "../hooks/useHandoff";
import type { HandoffChild } from "../services/handoffApi";
import { initialDrafts, type ChildDraft } from "../utils/review";
import { HandoffChildCard } from "./HandoffChildCard";

/** Coming back to this exact page after signing up or logging in. */
const RETURN_HERE = encodeURIComponent("/start");

function Message({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="border-ink/15 space-y-3 rounded-lg border bg-white p-6">
      <h1 className="text-ink text-xl font-semibold">{title}</h1>
      {children && <div className="space-y-3 text-sm text-slate-600">{children}</div>}
    </div>
  );
}

function Review({
  items,
  handoff,
}: {
  items: HandoffChild[];
  handoff: ReturnType<typeof useHandoff>;
}) {
  const { session, submitting, errors, result, submit } = handoff;
  // Only what the parent has changed is kept. A child with no entry is shown as it arrived,
  // so a list that changes after a partial import never needs its drafts reset.
  const [changes, setChanges] = useState<Record<string, ChildDraft>>({});
  const draftOf = (child: HandoffChild): ChildDraft =>
    changes[child.key] ?? initialDrafts([child])[child.key]!;
  const allDrafts = () => Object.fromEntries(items.map((child) => [child.key, draftOf(child)]));

  const chosen = items.filter((child) => draftOf(child).include).length;
  const anonymous = session === "anonymous";

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-ink text-2xl font-semibold">Continue from WhatsApp</h1>
        <p className="text-sm text-slate-600">
          Here is what you told our assistant. Check it
          {anonymous ? "" : ", add each child's date of birth,"} and we will{" "}
          {anonymous ? "keep it ready for your profile" : "create their profiles"}. Nothing is saved
          to your profile until you confirm.
        </p>
      </header>

      {result && (result.failed.length > 0 || result.skipped.length > 0) && (
        <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          {result.created.length > 0 && <p>Added: {result.created.join(", ")}.</p>}
          {result.skipped.length > 0 && (
            <p>Already on your profile, so not added again: {result.skipped.join(", ")}.</p>
          )}
          {result.failed.map((item) => (
            <p key={item.name}>
              {item.name}: {item.reason}
            </p>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {items.map((child) => (
          <HandoffChildCard
            key={child.key}
            child={child}
            draft={draftOf(child)}
            error={errors[child.key]}
            preview={session !== "parent"}
            onChange={(patch) =>
              setChanges((current) => ({
                ...current,
                [child.key]: { ...(current[child.key] ?? draftOf(child)), ...patch },
              }))
            }
          />
        ))}
      </div>

      {session === "unknown" && (
        <p role="status" className="text-sm text-slate-600">
          Checking your account...
        </p>
      )}

      {anonymous && (
        <Message title="Create your profile to keep this">
          <p>
            Sign up or log in and you will come straight back here to confirm. This page stays ready
            for a week.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={`/register?redirect=${RETURN_HERE}`}>Create account</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/login?redirect=${RETURN_HERE}`}>Log in</Link>
            </Button>
          </div>
        </Message>
      )}

      {session === "not-a-parent" && (
        <Message title="Switch to a parent profile">
          <p>
            Only a parent profile can add children. Your account is set up for something else, so
            sign in with a parent account to continue.
          </p>
        </Message>
      )}

      {session === "parent" && (
        <div className="space-y-2">
          {errors._ && <p className="text-sm text-red-600">{errors._}</p>}
          <Button
            type="button"
            loading={submitting}
            disabled={chosen === 0}
            onClick={() => void submit(allDrafts())}
          >
            {chosen > 1 ? `Create ${chosen} profiles` : "Create profile"}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * "Continue from WhatsApp": what the assistant kept, ready to become profiles.
 *
 * A signed-out parent sees what was kept and is sent to sign up or log in and straight back.
 * A parent signed in confirms each child with a date of birth. Nothing is saved to a profile
 * until they do.
 */
export function HandoffPage() {
  const handoff = useHandoff();
  const { state } = handoff;

  if (state.kind === "checking" || state.kind === "loading") {
    return (
      <p role="status" className="text-sm text-slate-600">
        Getting your details...
      </p>
    );
  }

  if (state.kind === "no-link") {
    return (
      <Message title="This link has no details">
        <p>
          Open the link the assistant sent you on WhatsApp. If it stopped working, ask the assistant
          for a new one.
        </p>
        <Button asChild variant="outline">
          <Link href="/">Go to PowerMySport</Link>
        </Button>
      </Message>
    );
  }

  if (state.kind === "problem") {
    return (
      <Message title="We could not open your details">
        <p>{state.message}</p>
        <Button asChild variant="outline">
          <Link href="/">Go to PowerMySport</Link>
        </Button>
      </Message>
    );
  }

  return <Review handoff={handoff} items={state.children} />;
}
