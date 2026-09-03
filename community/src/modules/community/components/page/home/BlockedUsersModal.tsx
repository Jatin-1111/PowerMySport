import { motion, AnimatePresence } from "framer-motion";
import { X, UserX, Loader2 } from "lucide-react";
import { BlockedUser } from "@/modules/community/types";
import { getAvatarCharacter } from "@/modules/community/utils/chatUtils";

export function BlockedUsersModal({
  isOpen,
  onClose,
  blockedUsers,
  isLoading,
  onUnblock,
}: {
  isOpen: boolean;
  onClose: () => void;
  blockedUsers: BlockedUser[];
  isLoading?: boolean;
  onUnblock: (userId: string) => void;
}) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
            <h3 className="text-lg font-bold text-slate-900">Blocked Users</h3>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-2">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Loader2 size={22} className="text-power-orange animate-spin" />
              </div>
            ) : blockedUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-400">
                  <UserX size={24} />
                </div>
                <p className="text-sm font-medium text-slate-600">No blocked users</p>
              </div>
            ) : (
              blockedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 transition hover:bg-slate-50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="bg-power-orange/10 text-power-orange flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold">
                      {user.photoUrl ? (
                        <img
                          src={user.photoUrl}
                          alt={user.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        getAvatarCharacter(user.name)
                      )}
                    </div>
                    <span className="truncate text-sm font-medium text-slate-700">{user.name}</span>
                  </div>
                  <button
                    onClick={() => onUnblock(user.id)}
                    className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 active:scale-95"
                  >
                    Unblock
                  </button>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
