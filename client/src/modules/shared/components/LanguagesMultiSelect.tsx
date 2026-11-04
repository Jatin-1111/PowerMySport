"use client";

import MultiSelectDropdown from "@/modules/shared/components/MultiSelectDropdown";

const LANGUAGE_OPTIONS = [
  "English",
  "Hindi",
  "Spanish",
  "French",
  "German",
  "Tamil",
  "Telugu",
  "Marathi",
  "Punjabi",
  "Gujarati",
  "Bengali",
  "Malayalam",
  "Other",
];

interface LanguagesMultiSelectProps {
  value: string[];
  onChange: (languages: string[]) => void;
  disabled?: boolean;
  id?: string;
}

export default function LanguagesMultiSelect({
  value,
  onChange,
  disabled = false,
  id,
}: LanguagesMultiSelectProps) {
  return (
    <MultiSelectDropdown
      label="Languages"
      id={id}
      options={LANGUAGE_OPTIONS}
      value={value}
      onChange={onChange}
      placeholder="Select languages..."
      addMoreText="Add more languages..."
      disabled={disabled}
    />
  );
}
