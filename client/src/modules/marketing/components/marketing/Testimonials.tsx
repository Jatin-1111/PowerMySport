import { Card, CardContent } from "@/modules/shared/ui/Card";
import { cn } from "@/utils/cn";
import { Star } from "lucide-react";
import Image from "next/image";
import React from "react";

export interface Testimonial {
  quote: string;
  author: string;
  role: string;
  avatar?: string;
  rating?: number;
}

export interface TestimonialsProps {
  title?: string;
  subtitle?: string;
  testimonials: Testimonial[];
  variant?: "default" | "centered";
}

/**
 * Testimonials Section Component
 * Displays customer reviews and social proof
 */
export const Testimonials: React.FC<TestimonialsProps> = ({
  title,
  subtitle,
  testimonials,
}) => {
  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        {(title || subtitle) && (
          <div className="text-center mb-12 sm:mb-16">
            {subtitle && (
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
                {subtitle}
              </p>
            )}
            {title && (
              <h2 className="font-title text-3xl sm:text-4xl lg:text-5xl font-bold text-deep-slate">
                {title}
              </h2>
            )}
          </div>
        )}

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {testimonials.map((testimonial, index) => (
            <Card
              key={index}
              variant="elevated"
              className="group h-full rounded-2xl border border-white/60 bg-white/80 backdrop-blur-md premium-shadow transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
            >
              <CardContent className="pt-6">
                {/* Rating */}
                {testimonial.rating && (
                  <div className="flex mb-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "h-5 w-5",
                          i < testimonial.rating!
                            ? "text-yellow-400 fill-yellow-400"
                            : "text-gray-300",
                        )}
                      />
                    ))}
                  </div>
                )}

                {/* Quote */}
                <blockquote className="mb-6 text-base leading-relaxed text-slate-700">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>

                {/* Author */}
                <div className="flex items-center">
                  {!testimonial.avatar && (
                    <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-full bg-power-orange text-white font-semibold transition-transform group-hover:scale-110">
                      {testimonial.author.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-slate-900">
                      {testimonial.author}
                    </div>
                    <div className="text-sm text-slate-600">
                      {testimonial.role}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
