import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  View,
  type TouchableOpacityProps,
} from 'react-native';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends TouchableOpacityProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: React.ReactNode;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

const variantStyles: Record<Variant, string> = {
  primary: 'bg-power-orange',
  secondary: 'bg-deep-slate',
  outline: 'bg-transparent border border-deep-slate',
  ghost: 'bg-transparent',
  destructive: 'bg-error-red',
};

const variantTextStyles: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-white',
  outline: 'text-deep-slate',
  ghost: 'text-deep-slate',
  destructive: 'text-white',
};

const sizeStyles: Record<Size, string> = {
  sm: 'px-3 py-2 rounded-lg',
  md: 'px-5 py-3 rounded-xl',
  lg: 'px-6 py-4 rounded-xl',
};

const sizeTextStyles: Record<Size, string> = {
  sm: 'text-sm font-medium',
  md: 'text-base font-semibold',
  lg: 'text-lg font-semibold',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  icon,
  iconPosition = 'left',
  className,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={isDisabled}
      className={`
        flex-row items-center justify-center
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${isDisabled ? 'opacity-50' : ''}
      `}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'ghost' ? '#0F172A' : '#FFFFFF'}
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <View className="mr-2">{icon}</View>
          )}
          <Text className={`${variantTextStyles[variant]} ${sizeTextStyles[size]}`}>
            {children}
          </Text>
          {icon && iconPosition === 'right' && (
            <View className="ml-2">{icon}</View>
          )}
        </>
      )}
    </TouchableOpacity>
  );
}
