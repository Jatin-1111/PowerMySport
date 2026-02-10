import { cn } from "@/utils/cn";
import React from "react";

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl" | "full";
  children: React.ReactNode;
}

/**
 * Container component for consistent content width across pages
 * @example
 * <Container size="lg">
 *   <h1>Page Content</h1>
 * </Container>
 */
export const Container: React.FC<ContainerProps> = ({
  size = "lg",
  className,
  children,
  ...props
}) => {
  const sizes = {
    sm: "max-w-2xl", // 672px
    md: "max-w-4xl", // 896px
    lg: "max-w-6xl", // 1152px
    xl: "max-w-7xl", // 1280px
    full: "max-w-full", // 100%
  };

  return (
    <div
      className={cn("mx-auto px-4 sm:px-6 lg:px-8", sizes[size], className)}
      {...props}
    >
      {children}
    </div>
  );
};

