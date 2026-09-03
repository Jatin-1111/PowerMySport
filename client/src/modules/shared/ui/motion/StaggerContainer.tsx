"use client";

import { HTMLMotionProps, motion, Variants } from "framer-motion";
import { forwardRef } from "react";

interface StaggerContainerProps extends HTMLMotionProps<"div"> {
  staggerChildren?: number;
  delayChildren?: number;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: (custom) => ({
    opacity: 1,
    transition: {
      staggerChildren: custom?.staggerChildren || 0.1,
      delayChildren: custom?.delayChildren || 0,
    },
  }),
};

/**
 * Must be used in conjunction with StaggerItem for children.
 */
export const StaggerContainer = forwardRef<HTMLDivElement, StaggerContainerProps>(
  ({ children, staggerChildren = 0.1, delayChildren = 0, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        variants={containerVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-50px" }}
        custom={{ staggerChildren, delayChildren }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
StaggerContainer.displayName = "StaggerContainer";

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export const StaggerItem = forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
  ({ children, ...props }, ref) => {
    return (
      <motion.div ref={ref} variants={itemVariants} {...props}>
        {children}
      </motion.div>
    );
  }
);
StaggerItem.displayName = "StaggerItem";
