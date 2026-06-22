import React from 'react';
import { View, Text } from 'react-native';

type BadgeVariant = 'default' | 'success' | 'warning' | 'destructive' | 'outline' | 'orange';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, { container: string; text: string }> = {
  default: { container: 'bg-gray-100', text: 'text-gray-700' },
  success: { container: 'bg-turf-green/15', text: 'text-turf-green' },
  warning: { container: 'bg-yellow-100', text: 'text-yellow-700' },
  destructive: { container: 'bg-error-red/15', text: 'text-error-red' },
  outline: { container: 'bg-transparent border border-border', text: 'text-foreground' },
  orange: { container: 'bg-power-orange/15', text: 'text-power-orange' },
};

export function Badge({ children, variant = 'default' }: BadgeProps) {
  const styles = variantStyles[variant];
  return (
    <View className={`px-2.5 py-0.5 rounded-full self-start ${styles.container}`}>
      <Text className={`text-xs font-medium ${styles.text}`}>{children}</Text>
    </View>
  );
}
