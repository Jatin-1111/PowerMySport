import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/Card";
import { cn } from "@/utils/cn";
import {
  BarChart3,
  Calendar,
  CreditCard,
  MapPin,
  ShieldCheck,
  Star,
  Users,
  Zap,
} from "lucide-react";
import React from "react";

export interface Feature {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

export interface FeaturesProps {
  title?: string;
  subtitle?: string;
  description?: string;
  features: Feature[];
  columns?: 2 | 3 | 4;
  variant?: "default" | "centered";
}

/**
 * Features Section Component
 * Displays a grid of feature cards
 */
export const Features: React.FC<FeaturesProps> = ({
  title,
  subtitle,
  description,
  features,
  columns = 3,
  variant = "default",
}) => {
  const gridCols = {
    2: "md:grid-cols-2",
    3: "md:grid-cols-2 lg:grid-cols-3",
    4: "md:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        {(title || subtitle || description) && (
          <div
            className={cn(
              "mb-12 sm:mb-16",
              variant === "centered" ? "text-center max-w-3xl mx-auto" : "",
            )}
          >
            {subtitle && (
              <p className="text-sm font-semibold text-power-orange uppercase tracking-wide mb-3">
                {subtitle}
              </p>
            )}
            {title && (
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-deep-slate mb-4">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-lg text-muted-foreground">{description}</p>
            )}
          </div>
        )}

        {/* Features Grid */}
        <div className={cn("grid grid-cols-1 gap-8", gridCols[columns])}>
          {features.map((feature, index) => (
            <Card key={index} variant="elevated">
              <CardContent className="pt-6">
                {/* Icon */}
                {feature.icon && (
                  <div className="mb-4 text-power-orange">{feature.icon}</div>
                )}
                {/* Title */}
                <CardTitle className="text-xl mb-3">{feature.title}</CardTitle>
                {/* Description */}
                <CardDescription className="text-base">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

/**
 * Default feature icons using Lucide React
 */
export const FeatureIcons = {
  Calendar: <Calendar className="h-10 w-10" />,
  Location: <MapPin className="h-10 w-10" />,
  Users: <Users className="h-10 w-10" />,
  Shield: <ShieldCheck className="h-10 w-10" />,
  Lightning: <Zap className="h-10 w-10" />,
  CreditCard: <CreditCard className="h-10 w-10" />,
  Star: <Star className="h-10 w-10" />,
  Chart: <BarChart3 className="h-10 w-10" />,
};
