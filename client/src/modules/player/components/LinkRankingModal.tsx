"use client";

import { ProfileEditField } from "@/modules/player/components/ProfileEditField";
import { rankingClaimApi, type RankingClaim } from "@/modules/player/services/rankingClaim";
import { Button } from "@/modules/shared/ui/Button";
import { Input } from "@/modules/shared/ui/Input";
import { Modal } from "@/modules/shared/ui/Modal";
import { Calendar, Hash, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

/**
 * Proving that a ranked player is your child.
 *
 * ── Why this asks for a date of birth ────────────────────────────────────────
 * Everything else on a ranking list is public: the name, the state, the
 * registration number, the age category. The exact date of birth is the one
 * thing the list does not print, which makes it the only fact that separates a
 * parent from a stranger who can read the same page.
 *
 * That has to be said on the screen, not just implemented. A form that demands
 * a child's date of birth without explaining why reads as data collection, and
 * the honest version — we are checking it, not keeping it — is also the one
 * that makes the parent trust the alerts that follow.
 *
 * ── Why the failure message is vague, deliberately ───────────────────────────
 * The server answers a wrong date and an unknown registration number with the
 * same sentence, so that this form cannot be used to discover whether a given
 * child is ranked. That is a security property, so this component renders the
 * server's message as-is and never tries to be more helpful about which half
 * was wrong. It does not know, and it must not guess.
 */

interface LinkRankingModalProps {
  isOpen: boolean;
  onClose: () => void;
  dependentId: string;
  dependentName: string;
  /** Prefills nothing; used only to word the copy. */
  sportSlug?: string;
  onLinked: (claim: RankingClaim) => void;
}

const getErrorMessage = (error: unknown): string => {
  const response = (error as { response?: { data?: { message?: string } } })?.response;
  return response?.data?.message ?? "Could not link this ranking. Please try again.";
};

export default function LinkRankingModal({
  isOpen,
  onClose,
  dependentId,
  dependentName,
  sportSlug = "tennis",
  onLinked,
}: LinkRankingModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Link ${dependentName}'s ranking`} size="md">
      {/* Mounted only while open, so every opening starts from a blank form.
          That is the whole reason the fields live in a child component: an
          effect that reset them on `isOpen` would be a setState in an effect
          body, which is both a lint error and a needless second render. */}
      {isOpen && (
        <ClaimForm
          onClose={onClose}
          dependentId={dependentId}
          dependentName={dependentName}
          sportSlug={sportSlug}
          onLinked={onLinked}
        />
      )}
    </Modal>
  );
}

function ClaimForm({
  onClose,
  dependentId,
  dependentName,
  sportSlug,
  onLinked,
}: Omit<LinkRankingModalProps, "isOpen" | "sportSlug"> & { sportSlug: string }) {
  const [regNo, setRegNo] = useState("");
  const [dob, setDob] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const maxDob = useMemo(() => new Date().toISOString().split("T")[0], []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!/^\d{4,8}$/.test(regNo.trim())) {
      setError("Enter a registration number of 4 to 8 digits.");
      return;
    }
    if (!dob) {
      setError("Enter the date of birth on the federation's record.");
      return;
    }

    setIsSubmitting(true);
    try {
      const claim = await rankingClaimApi.create({
        dependentId,
        regNo: regNo.trim(),
        dob,
        sportSlug,
      });
      onLinked(claim);
      onClose();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-sm leading-relaxed text-slate-600">
        Once linked, {dependentName}&apos;s current rank, movement and points appear on their
        profile, and you can be told when a new list is published.
      </p>

      <ProfileEditField
        label="Registration number"
        htmlFor="ranking-reg-no"
        icon={Hash}
        required
        hint="The number printed next to your child's name on the federation's ranking list."
      >
        <Input
          id="ranking-reg-no"
          inputMode="numeric"
          autoComplete="off"
          placeholder="e.g. 440090"
          value={regNo}
          onChange={(event) => setRegNo(event.target.value.replace(/\D/g, "").slice(0, 8))}
        />
      </ProfileEditField>

      <ProfileEditField
        label="Date of birth"
        htmlFor="ranking-dob"
        icon={Calendar}
        required
        hint="Checked against the federation's own record, then discarded. We do not store it here."
      >
        <Input
          id="ranking-dob"
          type="date"
          max={maxDob}
          value={dob}
          onChange={(event) => setDob(event.target.value)}
        />
      </ProfileEditField>

      <div className="flex gap-3 rounded-lg bg-slate-50 p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <p className="text-xs leading-relaxed text-slate-600">
          The date of birth is what proves this is your child rather than someone whose name you
          found on a public list. One account can link a given ranking, and you can unlink it at any
          time.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Checking..." : "Link ranking"}
        </Button>
      </div>
    </form>
  );
}
