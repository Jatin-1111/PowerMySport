"use client";

import { AssistantChatDrawer } from "@/modules/guidance/components/chat/AssistantChatDrawer";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

export function AIAssistantBubble() {
  const [hovered, setHovered] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const handler = (e: Event) =>
      setChatOpen((e as CustomEvent<{ isOpen: boolean }>).detail.isOpen);
    window.addEventListener("chat-drawer-change", handler);
    return () => window.removeEventListener("chat-drawer-change", handler);
  }, []);

  return (
    <>
      <AssistantChatDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {!chatOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex select-none flex-col items-end gap-3">
          {/* Popup tooltip card */}
          <AnimatePresence>
            {hovered && (
              <motion.div
                key="ai-popup"
                initial={{ opacity: 0, y: 8, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.94 }}
                transition={{ type: "spring", stiffness: 340, damping: 26 }}
                className="relative mb-1 w-52 rounded-2xl border border-slate-100 bg-white px-4 py-3.5 shadow-2xl"
              >
                {/* Downward caret */}
                <div
                  aria-hidden="true"
                  className="absolute -bottom-[7px] right-[22px] h-3.5 w-3.5 rotate-45 border-b border-r border-slate-100 bg-white"
                />
                <p className="text-power-orange text-[11px] font-bold uppercase tracking-widest">
                  PowerMySport AI
                </p>
                <p className="mt-1 text-sm font-bold leading-snug text-slate-900">
                  Get instant sports guidance
                </p>
                <p className="mt-0.5 text-xs text-slate-400">Free, personalized for your child</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main bubble — enters after 2 s so page loads first */}
          <div className="flex items-center gap-2">
            <motion.button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Chat with PowerMySport AI"
              onHoverStart={() => setHovered(true)}
              onHoverEnd={() => setHovered(false)}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20, delay: 2 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.91 }}
              className="bg-power-orange relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg shadow-orange-500/30"
            >
              {/* Attention pulse ring */}
              <span
                aria-hidden="true"
                className="bg-power-orange absolute inset-0 animate-ping rounded-full opacity-25"
              />
              <MessageCircle
                className="relative z-10 h-7 w-7"
                strokeWidth={2.25}
                aria-hidden="true"
              />
              {/* AI sparkle badge */}
              <span
                aria-hidden="true"
                className="ring-power-orange absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white ring-2"
              >
                <Sparkles className="text-power-orange h-3 w-3" fill="currentColor" />
              </span>
            </motion.button>
          </div>
        </div>
      )}
    </>
  );
}
