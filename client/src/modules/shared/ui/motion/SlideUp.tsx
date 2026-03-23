"use client";

import { HTMLMotionProps, motion } from "framer-motion";
import { forwardRef } from "react";

interface SlideUpProps extends HTMLMotionProps<"div"> {
  delay?: number;
  duration?: number;
  yOffset?: number;
}

export const SlideUp = forwardRef<HTMLDivElement, SlideUpProps>(
  ({ children, delay = 0, duration = 0.5, yOffset = 30, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: yOffset }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration, delay, ease: "easeOut" }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

SlideUp.displayName = "SlideUp";
