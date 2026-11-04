import React from "react";
import { HomeClosing } from "./HomeClosing";

export interface CTAProps {
  title: string;
  description: string;
  primaryCTA: { label: string; href: string };
  secondaryCTA?: { label: string; href: string };
  /** Accepted for existing call sites; the closing panel has no label. */
  label?: string;
}

/**
 * The panel that closes a marketing page. It is the same orange closing the
 * homepage uses, so every page ends with one full-colour moment.
 */
export const CTA: React.FC<CTAProps> = ({ title, description, primaryCTA, secondaryCTA }) => (
  <HomeClosing
    title={title}
    description={description}
    primaryCTA={primaryCTA}
    secondaryCTA={secondaryCTA}
  />
);
