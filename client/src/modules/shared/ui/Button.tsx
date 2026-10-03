import { cn } from "@/utils/cn";
import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "success" | "danger";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  asChild?: boolean;
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
      asChild = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    // Every variant carries a 1px border (transparent on the solid ones) so an
    // outline button and a filled one placed side by side are the same height.
    // Hover only ever darkens or tints: the primary used to go lighter on hover,
    // to orange-600, which also dropped white text below AA while hovered.
    // Focus rings are keyboard-only (`focus-visible`), not drawn on every click.
    const baseStyles =
      "btn-motion inline-flex items-center justify-center gap-2 rounded-md border border-transparent font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
      primary:
        "bg-power-orange-solid text-white hover:bg-orange-800 focus-visible:ring-power-orange-solid",
      secondary: "bg-deep-slate text-white hover:bg-slate-800 focus-visible:ring-deep-slate",
      outline:
        "border-power-orange-solid text-power-orange-solid hover:bg-orange-50 focus-visible:ring-power-orange-solid",
      ghost: "text-power-orange-solid hover:bg-orange-50 focus-visible:ring-power-orange-solid",
      // The 700 steps, not the brand turf-green/error-red: white text on those
      // measures 2.3:1 and 3.8:1.
      success: "bg-green-700 text-white hover:bg-green-800 focus-visible:ring-green-700",
      danger: "bg-red-700 text-white hover:bg-red-800 focus-visible:ring-red-700",
    };

    const sizes = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-6 py-2.5 text-base",
      lg: "px-8 py-3 text-lg",
    };

    if (asChild) {
      return (
        <Slot
          ref={ref}
          className={cn(
            baseStyles,
            variants[variant],
            sizes[size],
            fullWidth && "w-full",
            loading && "cursor-wait",
            className
          )}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          fullWidth && "w-full",
          loading && "cursor-wait",
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading...</span>
          </>
        ) : (
          <>
            {icon && <span className="shrink-0">{icon}</span>}
            {children}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
