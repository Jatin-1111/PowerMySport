"use client";

import { toast } from "@/lib/toast";
import { BinaryCards } from "@/modules/find-sport/components/inputs/BinaryCards";
import { ProfileEditField } from "@/modules/player/components/ProfileEditField";
import { ProfileFormSelect } from "@/modules/player/components/ProfileFormSelect";
import { DEFAULT_DEPENDENT_RELATION, DEPENDENT_RELATIONS } from "../data/dependentRelations";
import { getDependentAge } from "@/modules/player/utils/dependentAge";
import { normalizeDependent } from "@/modules/player/utils/dependentNormalize";
import { Button } from "@/modules/shared/ui/Button";
import { Input } from "../../shared/ui/Input";
import { Modal } from "@/modules/shared/ui/Modal";
import type { Dependent } from "@/types";
import { Calendar, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface QuickAddDependentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Dependent) => Promise<void>;
  isLoading?: boolean;
}

const EMPTY_FORM = {
  name: "",
  dob: "",
  gender: "MALE" as "MALE" | "FEMALE" | "OTHER",
  relation: DEFAULT_DEPENDENT_RELATION,
};

/** The fast path for adding a child: just enough to create the profile
 * (name + dob; gender/relation default sensibly). Everything else — sport,
 * physical/personality/comfort traits — is collected later via
 * `DependentManagementModal`, reached either from the dependent's own page
 * or the "complete your profile" nudge. Keeping this separate from that
 * 6-step modal is the point: a parent adding a second or third child
 * shouldn't have to click past five optional screens to do it. */
export default function QuickAddDependentModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: QuickAddDependentModalProps) {
  const [formData, setFormData] = useState(EMPTY_FORM);

  const maxDob = useMemo(() => new Date().toISOString().split("T")[0], []);
  const minDob = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().split("T")[0];
  }, []);

  useEffect(() => {
    if (isOpen) setFormData(EMPTY_FORM);
  }, [isOpen]);

  const previewAge = formData.dob ? getDependentAge(formData.dob) : null;

  const handleChange = (field: keyof typeof EMPTY_FORM, value: unknown) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!formData.dob) {
      toast.error("Date of birth is required");
      return;
    }
    const age = getDependentAge(formData.dob);
    if (age === null) {
      toast.error("Enter a valid date of birth");
      return;
    }
    if (age >= 18) {
      toast.error("Must be under 18 years old");
      return;
    }

    try {
      await onSubmit(normalizeDependent(formData));
      setFormData(EMPTY_FORM);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add dependent");
    }
  };

  const canSubmit = formData.name.trim().length > 0 && !!formData.dob;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Child Profile"
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="quick-add-dependent-form"
            loading={isLoading}
            disabled={!canSubmit}
            className="min-w-[140px]"
          >
            Save profile
          </Button>
        </div>
      }
    >
      <form id="quick-add-dependent-form" onSubmit={handleSubmit} className="space-y-5">
        <p className="text-sm text-slate-500">
          Just the basics for now — you can add their sport, physical, and personality details
          anytime from their profile.
        </p>

        <ProfileEditField label="Name" htmlFor="qad-name" required icon={UserRound}>
          <Input
            id="qad-name"
            type="text"
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="e.g., Riya Sharma"
            autoComplete="name"
            autoFocus // eslint-disable-line jsx-a11y/no-autofocus
          />
        </ProfileEditField>

        <ProfileEditField
          label="Date of birth"
          htmlFor="qad-dob"
          required
          icon={Calendar}
          hint={
            previewAge !== null
              ? `Age: ${previewAge} years · Must be under 18.`
              : "Must be under 18 years old."
          }
        >
          <Input
            id="qad-dob"
            type="date"
            value={formData.dob}
            onChange={(e) => handleChange("dob", e.target.value)}
            min={minDob}
            max={maxDob}
          />
        </ProfileEditField>

        <ProfileEditField label="Gender">
          <BinaryCards
            options={[
              { value: "MALE", title: "Boy", sub: "" },
              { value: "FEMALE", title: "Girl", sub: "" },
            ]}
            value={formData.gender === "OTHER" ? null : formData.gender}
            onChange={(v) => handleChange("gender", v as "MALE" | "FEMALE")}
          />
          <button
            type="button"
            onClick={() => handleChange("gender", formData.gender === "OTHER" ? "MALE" : "OTHER")}
            className="mt-2 text-xs text-slate-400 transition-colors hover:text-slate-600"
          >
            {formData.gender === "OTHER"
              ? "✓ Marked as Other / prefer not to say"
              : "Other / prefer not to say"}
          </button>
        </ProfileEditField>

        <ProfileEditField label="Relation" htmlFor="qad-relation" required>
          <ProfileFormSelect
            id="qad-relation"
            value={formData.relation}
            onChange={(v) => handleChange("relation", v)}
            options={DEPENDENT_RELATIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
        </ProfileEditField>
      </form>
    </Modal>
  );
}
