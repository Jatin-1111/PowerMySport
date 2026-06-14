import { Lock, MessageSquare, ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";

type Props = {
  onBack?: () => void;
};

export default function CommunityChatEmptyState({ onBack }: Props) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center relative bg-[#efeae2] bg-[radial-gradient(rgba(255,255,255,0.34)_1px,transparent_1px),radial-gradient(rgba(0,0,0,0.03)_1px,transparent_1px)] bg-position-[0_0,11px_11px] bg-size-[22px_22px]">
      {/* Mobile back button if somehow landed here */}
      {onBack && (
        <div className="absolute top-0 left-0 p-3 lg:hidden">
          <button
            onClick={onBack}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <ChevronLeft size={24} />
          </button>
        </div>
      )}

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex max-w-sm flex-col items-center text-center px-6"
      >
        <div className="mb-8 relative flex items-center justify-center">
          {/* Subtle glow/shadow under the icon */}
          <div className="absolute h-32 w-32 rounded-full bg-power-orange/5 blur-2xl" />
          <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-900/5">
            <MessageSquare size={48} strokeWidth={1.5} className="text-power-orange opacity-80 translate-y-1" />
          </div>
        </div>

        <h2 className="mb-3 text-3xl font-light text-slate-800 tracking-tight">
          PowerMySport Community
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-500">
          Select a conversation from the sidebar to view your messages, or start a new chat to connect with other athletes and parents.
        </p>
      </motion.div>

      {/* Encryption Badge at Bottom */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="absolute bottom-8 flex items-center gap-1.5 text-xs text-slate-400"
      >
        <Lock size={12} className="opacity-70" />
        <span className="font-medium">Secure and private messaging</span>
      </motion.div>
    </div>
  );
}
