import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/modules/shared/ui/Card";
import { cn } from "@/utils/cn";
import { motion } from "framer-motion";
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
    <section className="py-16 sm:py-20 lg:py-24">
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
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
                {subtitle}
              </p>
            )}
            {title && (
              <h2 className="font-title mb-4 text-3xl font-bold text-deep-slate sm:text-4xl lg:text-5xl">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-base leading-7 text-muted-foreground sm:text-lg">
                {description}
              </p>
            )}
          </div>
        )}

        {/* Features Grid */}
        <div
          className={cn("grid grid-cols-1 gap-6 sm:gap-8", gridCols[columns])}
        >
          {features.map((feature, index) => (
            <Card
              key={index}
              variant="elevated"
              className="group h-full rounded-2xl border border-white/60 bg-white/80 backdrop-blur-md premium-shadow transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
            >
              <CardContent className="pt-6">
                {/* Icon */}
                {feature.icon && (
                  <motion.div
                    className="mb-4 origin-center text-power-orange will-change-transform"
                    initial={{ opacity: 0, y: 10, scale: 0.94 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    whileHover={{ scale: 1.08, y: -2, rotate: 2 }}
                    whileTap={{ scale: 0.98 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {feature.icon}
                  </motion.div>
                )}
                {/* Title */}
                <CardTitle className="mb-3 text-xl text-slate-900">
                  {feature.title}
                </CardTitle>
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
