import { cn } from "@/utils/cn";
import React from "react";

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  spacing?: "sm" | "md" | "lg" | "xl";
  background?: "white" | "gray" | "gradient";
}

/**
 * Section component for page sections with consistent spacing
 * @example
 * <Section spacing="lg" background="gradient">
 *   <h2>Section Title</h2>
 *   <p>Content</p>
 * </Section>
 */
export const Section: React.FC<SectionProps> = ({
  children,
  className,
  spacing = "md",
  background = "white",
  ...props
}) => {
  const spacings = {
    sm: "py-8",
    md: "py-12 md:py-16",
    lg: "py-16 md:py-20",
    xl: "py-20 md:py-28",
  };

  const backgrounds = {
    white: "bg-background",
    gray: "bg-muted/10",
    gradient: "bg-gradient-to-br from-power-orange/5 to-turf-green/5",
  };

  return (
    <section
      className={cn(spacings[spacing], backgrounds[background], className)}
      {...props}
    >
      {children}
    </section>
  );
};
