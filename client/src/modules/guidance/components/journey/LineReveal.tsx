"use client";

import { motion } from "framer-motion";
import { LUXE_EASE } from "../../constants";

export function LineReveal({
  text,
  className,
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  return (
    <span className="block overflow-hidden">
      <motion.span
        initial={{ y: "115%" }}
        whileInView={{ y: 0 }}
        viewport={{ once: true, margin: "-70px" }}
        transition={{ duration: 0.65, ease: LUXE_EASE, delay }}
        className={`block ${className ?? ""}`}
      >
        {text}
      </motion.span>
    </span>
  );
}
