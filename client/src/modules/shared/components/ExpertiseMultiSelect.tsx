"use client";

import MultiSelectDropdown from "@/modules/shared/components/MultiSelectDropdown";

const EXPERTISE_OPTIONS = [
  "Technical Coaching",
  "Strength & Conditioning",
  "Sports Psychology",
  "Nutrition Planning",
  "Rehabilitation",
  "Strategy & Tactics",
  "Youth Development",
  "Professional Mentorship",
  "Fitness Training",
  "Biomechanics",
  "Other",
];

interface ExpertiseMultiSelectProps {
  value: string[];
  onChange: (expertise: string[]) => void;
  disabled?: boolean;
  id?: string;
}

export default function ExpertiseMultiSelect({
  value,
  onChange,
  disabled = false,
  id,
}: ExpertiseMultiSelectProps) {
  return (
    <MultiSelectDropdown
      label="Expertise"
      id={id}
      options={EXPERTISE_OPTIONS}
      value={value}
      onChange={onChange}
      placeholder="Select expertise..."
      addMoreText="Add more expertise..."
      disabled={disabled}
    />
  );
}
