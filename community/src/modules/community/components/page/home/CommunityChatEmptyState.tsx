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
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex max-w-sm flex-col items-center text-center px-6 relative z-10"
      >
        <div className="mb-10 relative flex items-center justify-center">
          {/* Breathing glow/shadow under the icon */}
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.4, 0.6, 0.4],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute h-40 w-40 rounded-full bg-power-orange/10 blur-3xl"
          />
          <motion.div
            animate={{ y: [-4, 4, -4] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="relative flex h-32 w-32 items-center justify-center rounded-[2.5rem] bg-white shadow-[0_8px_40px_rgba(233,115,22,0.12)] ring-1 ring-white/60 border border-slate-100"
          >
            <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-tr from-power-orange/5 to-transparent opacity-50" />
            <MessageSquare
              size={52}
              strokeWidth={1.2}
              className="text-power-orange opacity-90"
            />
          </motion.div>
        </div>

        <h2 className="mb-4 text-3xl font-semibold text-slate-900 tracking-tight">
          PowerMySport
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-500 max-w-[280px]">
          Select a conversation from the directory or start a new chat to
          connect with your community.
        </p>
      </motion.div>

      {/* Encryption Badge at Bottom */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="absolute bottom-8 flex items-center gap-1.5 text-xs text-slate-400"
      >
        <Lock size={12} className="opacity-70" />
        <span className="font-medium">Secure and private messaging</span>
      </motion.div>
    </div>
  );
}
