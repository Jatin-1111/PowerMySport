"use client";

import { useAuthStore } from "@/modules/auth/store/authStore";
import { AssistantChatDrawer } from "@/modules/guidance/components/chat/AssistantChatDrawer";
import { LoginRequiredModal } from "@/modules/guidance/components/chat/LoginRequiredModal";
import {
  OPEN_ASSISTANT_EVENT,
  type OpenAssistantDetail,
} from "@/modules/guidance/utils/assistantLauncher";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export function AIAssistantBubble() {
  const [hovered, setHovered] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginRedirect, setLoginRedirect] = useState("/");
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const { user, hydrated } = useAuthStore();
  const pathname = usePathname();

  // The assistant needs an account (its API is behind login), so a guest gets
  // the sign-in prompt instead of a drawer that fails to start a session. The
  // question they picked rides along in `?ask=` and is asked after login.
  const openAssistant = useCallback(
    (question?: string) => {
      if (!hydrated) return;
      if (!user) {
        const query = question ? `?ask=${encodeURIComponent(question)}` : "";
        setLoginRedirect(`${pathname}${query}`);
        setLoginOpen(true);
        return;
      }
      setPendingQuestion(question ?? null);
      setDrawerOpen(true);
    },
    [hydrated, user, pathname]
  );

  useEffect(() => {
    const handler = (e: Event) =>
      openAssistant((e as CustomEvent<OpenAssistantDetail>).detail?.question);
    window.addEventListener(OPEN_ASSISTANT_EVENT, handler);
    return () => window.removeEventListener(OPEN_ASSISTANT_EVENT, handler);
  }, [openAssistant]);

  // Back from login with a question in the URL: ask it, then tidy the address.
  useEffect(() => {
    if (!hydrated || !user) return;
    const params = new URLSearchParams(window.location.search);
    const question = params.get("ask");
    if (!question) return;
    params.delete("ask");
    const rest = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`);
    // Deferred a tick: opening sets state, which an effect body should not do.
    // Not cancelled on cleanup: the param is already gone from the URL, so a
    // second (Strict Mode) run would find nothing and the question would be lost.
    window.setTimeout(() => openAssistant(question), 0);
  }, [hydrated, user, openAssistant]);

  useEffect(() => {
    const handler = (e: Event) =>
      setChatOpen((e as CustomEvent<{ isOpen: boolean }>).detail.isOpen);
    window.addEventListener("chat-drawer-change", handler);
    return () => window.removeEventListener("chat-drawer-change", handler);
  }, []);

  return (
    <>
      <AssistantChatDrawer
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setPendingQuestion(null);
        }}
        initialQuestion={pendingQuestion}
        onInitialQuestionSent={() => setPendingQuestion(null)}
      />
      <LoginRequiredModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        variant="assistant"
        redirectPath={loginRedirect}
      />

      {!chatOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex select-none flex-col items-end gap-3">
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
              transform on whatever it animates, which would cancel the
              button's CSS press. It no longer springs from zero, wobbles on
              hover or pulses forever. */}
          <motion.div
            className="flex items-center gap-2"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1], delay: 2 }}
          >
            <button
              type="button"
              onClick={() => openAssistant()}
              aria-label="Chat with PowerMySport AI"
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              className="btn-motion bg-power-orange-solid focus-visible:ring-power-orange-solid relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg shadow-slate-900/20 hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
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
            </button>
          </motion.div>
        </div>
      )}
    </>
  );
}
