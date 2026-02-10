import { cn } from "@/utils/cn";
import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "interactive";
  children: React.ReactNode;
}

/**
 * Card component for content containers
 * @example
 * <Card variant="elevated">
 *   <h3>Title</h3>
 *   <p>Content</p>
 * </Card>
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", children, onClick, ...props }, ref) => {
    const baseStyles = "bg-card border border-border rounded-lg p-6";

    const variants = {
      default: "",
      elevated: "shadow-lg",
      interactive:
        "hover:shadow-xl transition-shadow duration-200 cursor-pointer hover:border-power-orange",
    };

    return (
      <div
        ref={ref}
        className={cn(baseStyles, variants[variant], className)}
        onClick={onClick}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  // Create a synthetic mouse event for onClick handler
                  const syntheticEvent = {
                    ...e,
                    currentTarget: e.currentTarget,
                  } as unknown as React.MouseEvent<HTMLDivElement>;
                  onClick(syntheticEvent);
                }
              }
            : undefined
        }
        {...props}
      >
        {children}
      </div>
    );
  },
);

Card.displayName = "Card";

/**
 * Card Header component
 */
export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div className={cn("mb-4", className)} {...props}>
      {children}
    </div>
  );
};

/**
 * Card Title component
 */
export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <h3
      className={cn("text-xl font-bold text-white", className)}
      {...props}
    >
      {children}
    </h3>
  );
};

/**
 * Card Description component
 */
export const CardDescription: React.FC<
  React.HTMLAttributes<HTMLParagraphElement>
> = ({ className, children, ...props }) => {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} {...props}>
      {children}
    </p>
  );
};

/**
 * Card Content component
 */
export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div className={cn("", className)} {...props}>
      {children}
    </div>
  );
};

/**
 * Card Footer component
 */
export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn("mt-4 pt-4 border-t border-border", className)}
      {...props}
    >
      {children}
    </div>
  );
};

