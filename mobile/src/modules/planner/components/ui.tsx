import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { COLORS } from "@lib/constants";

export function Panel({
  children,
  tone = "plain",
}: {
  children: React.ReactNode;
  tone?: "plain" | "warm";
}) {
  return (
    <View
      className={`rounded-tile border-hairline border p-4 ${tone === "warm" ? "bg-wash" : "bg-surface"}`}
    >
      {children}
    </View>
  );
}

export function Heading({ children }: { children: React.ReactNode }) {
  return <Text className="text-ink mb-2 text-lg font-semibold">{children}</Text>;
}

export function Body({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <Text className={`text-sm leading-relaxed ${muted ? "text-muted" : "text-body"}`}>
      {children}
    </Text>
  );
}

export function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "action" | "success";
}) {
  const styles = {
    neutral: "border-hairline bg-canvas text-body",
    action: "border-action bg-wash text-action",
    success: "border-success bg-canvas text-success",
  }[tone];
  const [box, text] = [styles.split(" ").slice(0, 2).join(" "), styles.split(" ")[2]];
  return (
    <View className={`rounded-button self-start border px-2 py-0.5 ${box}`}>
      <Text className={`text-xs font-medium ${text}`}>{label}</Text>
    </View>
  );
}

/** A tap target of at least 44 points, in the app's square-cornered style. */
export function SmallButton({
  label,
  onPress,
  variant = "outline",
  busy = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: "solid" | "outline" | "danger";
  busy?: boolean;
  disabled?: boolean;
}) {
  const box = {
    solid: "border-action bg-action",
    outline: "border-hairline bg-surface",
    danger: "border-hairline bg-surface",
  }[variant];
  const text =
    variant === "solid" ? "text-white" : variant === "danger" ? "text-danger" : "text-ink";
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      activeOpacity={0.7}
      className={`rounded-button min-h-[44px] items-center justify-center border px-4 ${box} ${disabled ? "opacity-40" : ""}`}
    >
      {busy ? (
        <ActivityIndicator size="small" color={variant === "solid" ? "#FFFFFF" : COLORS.ink} />
      ) : (
        <Text className={`text-sm font-semibold ${text}`}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

export function Collapsible({
  title,
  count,
  children,
  defaultOpen = false,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View className="rounded-tile border-hairline bg-surface mb-3 overflow-hidden border">
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className="min-h-[48px] flex-row items-center justify-between px-4 py-3"
      >
        <Text className="text-ink flex-1 text-base font-semibold">
          {title}
          {count !== undefined ? ` (${count})` : ""}
        </Text>
        {open ? (
          <ChevronUp size={18} color={COLORS.muted} />
        ) : (
          <ChevronDown size={18} color={COLORS.muted} />
        )}
      </TouchableOpacity>
      {open ? <View className="border-hairline border-t px-4 py-4">{children}</View> : null}
    </View>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <View className="rounded-button border-hairline bg-surface flex-row border p-1">
      {options.map((o) => (
        <TouchableOpacity
          key={o.value}
          onPress={() => onChange(o.value)}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === o.value }}
          className={`rounded-button min-h-[40px] flex-1 items-center justify-center ${value === o.value ? "bg-ink" : ""}`}
        >
          <Text
            className={`text-sm font-semibold ${value === o.value ? "text-white" : "text-ink"}`}
          >
            {o.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
