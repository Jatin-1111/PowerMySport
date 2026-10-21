import { Lock, MessageSquare, ChevronLeft } from "lucide-react";

type Props = {
  onBack?: () => void;
};

/** Shown when no conversation is open: one quiet statement on paper, no
 *  floating or glowing decoration. */
export default function CommunityChatEmptyState({ onBack }: Props) {
  return (
    <div className="bg-paper relative flex h-full w-full flex-col items-center justify-center">
      {onBack && (
        <div className="absolute left-0 top-0 p-3 lg:hidden">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to conversations"
            className="text-ink-body hover:bg-paper-deep inline-flex h-11 w-11 items-center justify-center rounded-md transition-colors duration-200"
          >
            <ChevronLeft size={22} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="flex max-w-sm flex-col items-start px-6">
        <MessageSquare size={32} strokeWidth={1.25} className="text-ink" aria-hidden="true" />
        <h2 className="font-editorial text-ink mt-5 text-4xl font-light leading-[1.1]">
          Pick a conversation.
        </h2>
        <p className="text-ink-body mt-3 text-base leading-relaxed">
          Choose someone from your inbox, or start a new chat to connect with other parents.
        </p>
      </div>

      <p className="text-ink-muted absolute bottom-8 flex items-center gap-1.5 text-sm">
        <Lock size={13} strokeWidth={1.5} aria-hidden="true" />
        Private messaging
      </p>
    </div>
  );
}
