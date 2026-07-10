"use client";

import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, CheckCircle, XCircle } from "lucide-react";

interface RoadmapIntroModalProps {
  isOpen: boolean;
  onYes: () => void;
  onNo: () => void;
}

export default function RoadmapIntroModal({
  isOpen,
  onYes,
  onNo,
}: RoadmapIntroModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 24 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Top accent */}
            <div className="h-1.5 w-full bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400" />

            <div className="p-8 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 dark:bg-orange-900/20">
                <HelpCircle className="h-8 w-8 text-orange-500" />
              </div>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                Do you know which sport
                <br />
                your child should play?
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 max-w-xs mx-auto">
                We&apos;ll guide you based on your answer — whether you have a
                sport in mind or need help finding the perfect fit.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={onYes}
                  className="flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-base transition-colors shadow-md shadow-orange-200 dark:shadow-orange-900/30"
                >
                  <CheckCircle className="h-5 w-5" />
                  Yes, I know the sport
                </button>
                <button
                  onClick={onNo}
                  className="flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-orange-300 dark:hover:border-orange-600 text-gray-700 dark:text-gray-200 font-semibold text-base transition-colors"
                >
                  <XCircle className="h-5 w-5 text-gray-400" />
                  No, help me decide
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
