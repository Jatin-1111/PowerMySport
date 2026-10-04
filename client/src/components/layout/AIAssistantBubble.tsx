"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * The floating way into the assistant. It is a plain link to /ask: the chat
 * lives on its own page, with room for the answers, rather than in a drawer
 * over whatever the parent was reading.
 *
 * It steps aside on /ask itself, and while one of the other chat drawers
 * (guidance, roadmap) is open, which announce themselves with the
 * `chat-drawer-change` event.
 */
export function AIAssistantBubble() {
  const [hovered, setHovered] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handler = (e: Event) =>
      setDrawerOpen((e as CustomEvent<{ isOpen: boolean }>).detail.isOpen);
    window.addEventListener("chat-drawer-change", handler);
    return () => window.removeEventListener("chat-drawer-change", handler);
  }, []);

  if (drawerOpen || pathname === "/ask" || pathname.startsWith("/ask/")) return null;

  return (
    <div
      data-ai-bubble
      className="fixed bottom-6 right-6 z-50 flex select-none flex-col items-end gap-3 transition-opacity duration-500"
    >
      {/* Popup tooltip card */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            key="ai-popup"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
            className="relative mb-1 w-52 rounded-lg border border-slate-100 bg-white px-4 py-3.5 shadow-2xl"
          >
            {/* Downward caret */}
            <div
              aria-hidden="true"
              className="absolute -bottom-[7px] right-[22px] h-3.5 w-3.5 rotate-45 border-b border-r border-slate-100 bg-white"
            />
            <p className="text-power-orange-solid text-xs font-bold uppercase tracking-widest">
              PowerMySport AI
            </p>
            <p className="mt-1 text-sm font-bold leading-snug text-slate-900">
              Get instant sports guidance
            </p>
            <p className="mt-0.5 text-xs text-slate-500">Free, personalized for your child</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main bubble: fades in after 2 s so the page loads first. The
          entrance lives on a wrapper because Framer Motion writes an inline
          transform on whatever it animates, which would cancel the link's CSS
          press. It no longer springs from zero, wobbles on hover or pulses
          forever. */}
      <motion.div
        className="flex items-center gap-2"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1], delay: 2 }}
      >
        <Link
          href="/ask"
          aria-label="Chat with PowerMySport AI"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
          className="btn-motion bg-power-orange-solid focus-visible:ring-power-orange-solid relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg shadow-slate-900/20 hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          <MessageCircle className="relative z-10 h-7 w-7" strokeWidth={2.25} aria-hidden="true" />
          {/* AI sparkle badge */}
          <span
            aria-hidden="true"
            className="ring-power-orange absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white ring-2"
          >
            <Sparkles className="text-power-orange h-3 w-3" fill="currentColor" />
          </span>
        </Link>
      </motion.div>
    </div>
  );
}
