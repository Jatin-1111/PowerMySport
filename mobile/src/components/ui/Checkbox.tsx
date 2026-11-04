import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Check } from "lucide-react-native";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
  error?: string;
}

// The box is never pre-ticked by callers: consent that was ticked for the user is not consent.
export function Checkbox({ checked, onChange, children, error }: CheckboxProps) {
  return (
    <View className="mb-3">
      <TouchableOpacity
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        activeOpacity={0.7}
        onPress={() => onChange(!checked)}
        className="flex-row items-start gap-3"
      >
        <View
          className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${
            checked
              ? "border-action bg-action"
              : error
                ? "border-danger bg-surface"
                : "border-ash bg-surface"
          }`}
        >
          {checked && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
        </View>
        <View className="flex-1">{children}</View>
      </TouchableOpacity>
      {error && <Text className="text-danger ml-8 mt-1 text-xs">{error}</Text>}
    </View>
  );
}
