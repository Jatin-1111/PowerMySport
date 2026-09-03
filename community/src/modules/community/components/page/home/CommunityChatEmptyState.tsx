import { Lock, MessageSquare, ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";

type Props = {
  onBack?: () => void;
};

export default function CommunityChatEmptyState({ onBack }: Props) {
  return (
    <div className="bg-size-[22px_22px] bg-position-[0_0,11px_11px] relative flex h-full w-full flex-col items-center justify-center bg-[#efeae2] bg-[radial-gradient(rgba(255,255,255,0.34)_1px,transparent_1px),radial-gradient(rgba(0,0,0,0.03)_1px,transparent_1px)]">
      {/* Mobile back button if somehow landed here */}
      {onBack && (
        <div className="absolute left-0 top-0 p-3 lg:hidden">
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
        className="relative z-10 flex max-w-sm flex-col items-center px-6 text-center"
      >
        <div className="relative mb-10 flex items-center justify-center">
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
            className="bg-power-orange/10 absolute h-40 w-40 rounded-full blur-3xl"
          />
          <motion.div
            animate={{ y: [-4, 4, -4] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="relative flex h-32 w-32 items-center justify-center rounded-[2.5rem] border border-slate-100 bg-white shadow-[0_8px_40px_rgba(233,115,22,0.12)] ring-1 ring-white/60"
          >
            <div className="from-power-orange/5 absolute inset-0 rounded-[2.5rem] bg-gradient-to-tr to-transparent opacity-50" />
            <MessageSquare size={52} strokeWidth={1.2} className="text-power-orange opacity-90" />
          </motion.div>
        </div>

        <h2 className="mb-4 text-3xl font-semibold tracking-tight text-slate-900">PowerMySport</h2>
        <p className="max-w-[280px] text-[15px] leading-relaxed text-slate-500">
          Select a conversation from the directory or start a new chat to connect with your
          community.
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
