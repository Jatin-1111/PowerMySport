import React from 'react';
import { View, type ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  variant?: 'default' | 'flat' | 'bordered';
}

export function Card({ children, variant = 'default', className, ...props }: CardProps) {
  const variantStyles = {
    default: 'bg-white rounded-2xl shadow-sm',
    flat: 'bg-white rounded-2xl',
    bordered: 'bg-white rounded-2xl border border-border',
  };

  return (
    <View className={`${variantStyles[variant]} overflow-hidden`} {...props}>
      {children}
    </View>
  );
}

export function CardHeader({ children, className, ...props }: ViewProps) {
  return (
    <View className="px-4 pt-4 pb-2" {...props}>
      {children}
    </View>
  );
}

export function CardContent({ children, className, ...props }: ViewProps) {
  return (
    <View className="px-4 pb-4" {...props}>
      {children}
    </View>
  );
}

export function CardFooter({ children, className, ...props }: ViewProps) {
  return (
    <View className="px-4 pt-2 pb-4 border-t border-border" {...props}>
      {children}
    </View>
  );
}
