import { cn } from "@/utils/cn";
import { Loader2 } from "lucide-react";
import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "secondary"
    | "outline"
    | "ghost"
    | "success"
    | "danger";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

/**
 * Unified Button component with consistent styling across the platform
 * @example
 * <Button variant="primary" size="lg">Get Started</Button>
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      fullWidth = false,
      loading = false,
      icon,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
      primary:
        "bg-power-orange text-white hover:bg-orange-600 focus:ring-power-orange",
      secondary:
        "bg-deep-slate text-white hover:bg-slate-700 focus:ring-deep-slate",
      outline:
        "border-2 border-power-orange text-power-orange hover:bg-power-orange hover:text-white focus:ring-power-orange",
      ghost: "text-power-orange hover:bg-orange-50 focus:ring-power-orange",
      success:
        "bg-turf-green text-white hover:bg-green-600 focus:ring-turf-green",
      danger: "bg-error-red text-white hover:bg-red-600 focus:ring-error-red",
    };

    const sizes = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-6 py-2.5 text-base",
      lg: "px-8 py-3 text-lg",
    };

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          fullWidth && "w-full",
          loading && "cursor-wait",
          className,
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin h-5 w-5" />
            <span>Loading...</span>
          </>
        ) : (
          <>
            {icon && <span className="flex-shrink-0">{icon}</span>}
            {children}
          </>
        )}
      </button>
    );
  },
);

Button.displayName = "Button";
