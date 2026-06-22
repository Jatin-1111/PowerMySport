import React, { useState } from 'react';
import {
  TextInput,
  View,
  Text,
  TouchableOpacity,
  type TextInputProps,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { COLORS } from '@lib/constants';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  hint?: string;
}

export function Input({
  label,
  error,
  leftIcon,
  rightIcon,
  hint,
  secureTextEntry,
  style,
  ...props
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = secureTextEntry;

  return (
    <View className="mb-4">
      {label && (
        <Text className="text-sm font-medium text-foreground mb-1.5">{label}</Text>
      )}
      <View
        className={`
          flex-row items-center
          bg-white border rounded-xl px-4 h-13
          ${error ? 'border-error-red' : 'border-border'}
        `}
      >
        {leftIcon && <View className="mr-3">{leftIcon}</View>}
        <TextInput
          className="flex-1 text-base text-foreground"
          placeholderTextColor={COLORS.muted}
          secureTextEntry={isPassword && !showPassword}
          autoCapitalize="none"
          style={style}
          {...props}
        />
        {isPassword ? (
          <TouchableOpacity
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {showPassword ? (
              <EyeOff size={18} color={COLORS.muted} />
            ) : (
              <Eye size={18} color={COLORS.muted} />
            )}
          </TouchableOpacity>
        ) : (
          rightIcon && <View className="ml-3">{rightIcon}</View>
        )}
      </View>
      {error && (
        <Text className="text-xs text-error-red mt-1">{error}</Text>
      )}
      {hint && !error && (
        <Text className="text-xs text-muted mt-1">{hint}</Text>
      )}
    </View>
  );
}
