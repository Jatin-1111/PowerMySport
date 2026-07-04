"use client";

import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { INDIAN_STATES } from "@/modules/guidance/constants";
import {
  DEFAULT_DEPENDENT_RELATION,
  DEPENDENT_RELATIONS,
  normalizeDependentRelation,
} from "@/modules/player/constants/dependentRelations";
import { ProfileEditField } from "@/modules/player/components/ProfileEditField";
import { ProfileEditPanel } from "@/modules/player/components/ProfileEditPanel";
import { ProfileFormSelect } from "@/modules/player/components/ProfileFormSelect";
import { Button } from "@/modules/shared/ui/Button";
import { Modal } from "@/modules/shared/ui/Modal";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface Dependent {
  _id?: string;
  name: string;
  dob: string | Date;
  gender?: "MALE" | "FEMALE" | "OTHER";
  relation?: string;
  sports?: string[];
  yearsPlaying?: number;
  personalityTags?: string[];
  primaryObjective?: "Recreational" | "Fitness" | "Compete";
  weeklyTimeCommitment?: number;
  budgetTier?: "Budget" | "Moderate" | "Premium";
  location?: string;
}

interface DependentManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Dependent) => Promise<void>;
  initialDependent?: Dependent | null;
  isLoading?: boolean;
  mode: "add" | "edit";
}

const EMPTY_FORM: Dependent = {
  name: "",
  dob: "",
  gender: "MALE",
  relation: DEFAULT_DEPENDENT_RELATION,
  sports: [],
  personalityTags: [],
  primaryObjective: "Recreational",
  weeklyTimeCommitment: 3,
  budgetTier: "Moderate",
  location: "",
};

const PERSONALITY_OPTIONS = [
  "Shy",
  "Energetic",
  "Competitive",
  "Social",
  "Focused",
  "Curious",
  "Patient",
  "Team-oriented",
];

function getDependentAge(dob: string | Date): number | null {
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }
  return age;
}

export default function DependentManagementModal({
  isOpen,
  onClose,
  onSubmit,
  initialDependent,
  isLoading = false,
  mode,
}: DependentManagementModalProps) {
  const [formData, setFormData] = useState<Dependent>(EMPTY_FORM);

  const maxDob = useMemo(() => new Date().toISOString().split("T")[0], []);
  const minDob = useMemo(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 18);
    return date.toISOString().split("T")[0];
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    if (initialDependent) {
      const dobValue = initialDependent.dob
        ? new Date(initialDependent.dob).toISOString().split("T")[0]
        : "";

      setFormData({
        ...initialDependent,
        dob: dobValue,
        relation: normalizeDependentRelation(initialDependent.relation),
      });
      return;
    }

    setFormData(EMPTY_FORM);
  }, [isOpen, initialDependent]);

  const handleChange = (field: keyof Dependent, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

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
      toast.error("Please enter a valid date of birth");
      return;
    }

    if (age >= 18) {
      toast.error("Dependents must be under 18 years old");
      return;
    }

    try {
      await onSubmit(formData);
      setFormData(EMPTY_FORM);
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to save dependent";
      toast.error(message);
    }
  };

  const previewAge = formData.dob ? getDependentAge(formData.dob) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === "add" ? "Add Dependent" : "Edit Dependent"}
      size="md"
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="dependent-form"
            loading={isLoading}
            className="w-full sm:min-w-[140px] sm:w-auto"
          >
            {mode === "add" ? "Add Dependent" : "Save Changes"}
          </Button>
        </div>
      }
    >
      <form id="dependent-form" onSubmit={handleSubmit}>
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="sports">Sports</TabsTrigger>
            <TabsTrigger value="ai">AI Guidance</TabsTrigger>
          </TabsList>
          
          <TabsContent value="basic" className="space-y-5">
            <ProfileEditPanel
          title={mode === "add" ? "New dependent profile" : "Update profile"}
          description={
            mode === "add"
              ? "Add a child or ward you manage bookings for. Dependents must be under 18."
              : "Update this dependent's details and save when you're done."
          }
        >
          <div className="space-y-4">
            <ProfileEditField
              label="Name"
              htmlFor="dependent-name"
              required
              icon={UserRound}
            >
              <Input
                id="dependent-name"
                type="text"
                value={formData.name}
                onChange={(event) => handleChange("name", event.target.value)}
                placeholder="e.g., John Doe"
                autoComplete="name"
              />
            </ProfileEditField>

            <ProfileEditField
              label="Date of Birth"
              htmlFor="dependent-dob"
              required
              icon={Calendar}
              hint={
                previewAge !== null
                  ? `Age: ${previewAge} years · Must be under 18.`
                  : "Must be under 18 years old."
              }
            >
              <Input
                id="dependent-dob"
                type="date"
                value={formData.dob as string}
                onChange={(event) => handleChange("dob", event.target.value)}
                min={minDob}
                max={maxDob}
              />
            </ProfileEditField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ProfileEditField label="Gender" htmlFor="dependent-gender">
                <ProfileFormSelect
                  id="dependent-gender"
                  value={formData.gender || "MALE"}
                  onChange={(value) => handleChange("gender", value)}
                  options={[
                    { value: "MALE", label: "Male" },
                    { value: "FEMALE", label: "Female" },
                    { value: "OTHER", label: "Other" },
                  ]}
                />
              </ProfileEditField>

              <ProfileEditField
                label="Relation"
                htmlFor="dependent-relation"
                required
              >
                <ProfileFormSelect
                  id="dependent-relation"
                  value={formData.relation || DEFAULT_DEPENDENT_RELATION}
                  onChange={(value) => handleChange("relation", value)}
                  options={DEPENDENT_RELATIONS.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                />
              </ProfileEditField>
            </div>
            </div>
          </ProfileEditPanel>
        </TabsContent>

        <TabsContent value="sports" className="space-y-5">
          <ProfileEditPanel
          title="Sports interests"
          description="Optional. Helps personalize venue and coach recommendations."
        >
          <ProfileEditField label="Sports">
            <SportsMultiSelect
              value={formData.sports || []}
              onChange={(sports) => handleChange("sports", sports)}
            />
          </ProfileEditField>

          <ProfileEditField
            label="Experience (Years)"
            htmlFor="dependent-years-playing"
            hint="Leave blank if they haven't started playing yet"
          >
            <Input
              id="dependent-years-playing"
              type="number"
              min="0"
              max="20"
              placeholder="e.g., 2"
              value={formData.yearsPlaying ?? ""}
              onChange={(event) =>
                handleChange(
                  "yearsPlaying",
                  event.target.value === "" ? undefined : parseInt(event.target.value, 10),
                )
              }
            />
          </ProfileEditField>

          {(formData.sports?.length ?? 0) > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {formData.sports?.map((sport) => (
                <Badge
                  key={sport}
                  className="border-orange-200 bg-white text-orange-700 hover:bg-white"
                >
                  {sport}
                </Badge>
              ))}
            </div>
          )}
          </ProfileEditPanel>
        </TabsContent>

        <TabsContent value="ai" className="space-y-5">
          <ProfileEditPanel
          title="AI Guidance Preferences"
          description="Optional. Used to pre-fill AI recommendations."
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ProfileEditField label="Primary Objective" htmlFor="primary-objective">
                <ProfileFormSelect
                  id="primary-objective"
                  value={formData.primaryObjective || "Recreational"}
                  onChange={(value) => handleChange("primaryObjective", value)}
                  options={[
                    { value: "Recreational", label: "Recreational" },
                    { value: "Fitness", label: "Fitness" },
                    { value: "Compete", label: "Compete" },
                  ]}
                />
              </ProfileEditField>

              <ProfileEditField label="Budget Tier" htmlFor="budget-tier">
                <ProfileFormSelect
                  id="budget-tier"
                  value={formData.budgetTier || "Moderate"}
                  onChange={(value) => handleChange("budgetTier", value)}
                  options={[
                    { value: "Budget", label: "Budget" },
                    { value: "Moderate", label: "Moderate" },
                    { value: "Premium", label: "Premium" },
                  ]}
                />
              </ProfileEditField>
            </div>

            <ProfileEditField label="State / Union Territory" htmlFor="dependent-location" hint="Used for local scheme & resource recommendations">
              <ProfileFormSelect
                id="dependent-location"
                value={formData.location || ""}
                onChange={(value) => handleChange("location", value)}
                options={[
                  { value: "", label: "— Select state —" },
                  ...INDIAN_STATES.map((s) => ({ value: s, label: s })),
                ]}
              />
            </ProfileEditField>

            <ProfileEditField label="Weekly Time Commitment (Hours)" htmlFor="weekly-time">
              <Input
                id="weekly-time"
                type="number"
                min="1"
                max="40"
                value={formData.weeklyTimeCommitment || 3}
                onChange={(e) => handleChange("weeklyTimeCommitment", parseInt(e.target.value) || 3)}
              />
            </ProfileEditField>

            <ProfileEditField label="Personality Tags">
              <div className="flex flex-wrap gap-2">
                {PERSONALITY_OPTIONS.map((tag) => {
                  const isSelected = formData.personalityTags?.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        const current = formData.personalityTags || [];
                        const next = isSelected
                          ? current.filter((t) => t !== tag)
                          : [...current, tag];
                        handleChange("personalityTags", next);
                      }}
                      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                        isSelected
                          ? "border-blue-600 bg-blue-50 font-medium text-blue-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </ProfileEditField>
          </div>
        </ProfileEditPanel>
        </TabsContent>
        </Tabs>
      </form>
    </Modal>
  );
}
