import React from "react";
import { View, Text, TextInput } from "react-native";
import { COLORS } from "@lib/constants";

export interface DobValue {
  day: string;
  month: string;
  year: string;
}

export const EMPTY_DOB: DobValue = { day: "", month: "", year: "" };

/** The date as YYYY-MM-DD, or null when the three boxes do not make a real calendar day. */
export function dobToIso({ day, month, year }: DobValue): string | null {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (!d || !m || year.length !== 4) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d)
    return null;
  return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function Box({
  label,
  value,
  onChangeText,
  maxLength,
  width,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  maxLength: number;
  width: number;
  placeholder: string;
}) {
  return (
    <View style={{ width }}>
      <Text className="text-muted mb-1.5 text-xs">{label}</Text>
      <TextInput
        value={value}
        onChangeText={(v) => onChangeText(v.replace(/\D/g, "").slice(0, maxLength))}
        keyboardType="number-pad"
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColor={COLORS.ash}
        accessibilityLabel={label}
        className="rounded-button border-hairline bg-surface text-ink h-12 border px-3 text-base"
      />
    </View>
  );
}

/** Day, month and year boxes: works the same on every platform and needs no native picker. */
export function DobFields({
  value,
  onChange,
}: {
  value: DobValue;
  onChange: (next: DobValue) => void;
}) {
  return (
    <View className="flex-row gap-3">
      <Box
        label="Day"
        placeholder="DD"
        value={value.day}
        maxLength={2}
        width={72}
        onChangeText={(day) => onChange({ ...value, day })}
      />
      <Box
        label="Month"
        placeholder="MM"
        value={value.month}
        maxLength={2}
        width={72}
        onChangeText={(month) => onChange({ ...value, month })}
      />
      <Box
        label="Year"
        placeholder="YYYY"
        value={value.year}
        maxLength={4}
        width={96}
        onChangeText={(year) => onChange({ ...value, year })}
      />
    </View>
  );
}
