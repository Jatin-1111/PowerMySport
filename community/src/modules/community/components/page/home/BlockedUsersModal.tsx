import { BlockedUser } from "@/modules/community/types";
import { getAvatarCharacter } from "@/modules/community/utils/chatUtils";
import CommunityDialog from "@/modules/community/components/CommunityDialog";

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
  return (
    <CommunityDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Blocked users"
      kicker="They cannot message you"
      maxWidthClassName="max-w-md"
    >
      {isLoading ? (
        <div aria-busy="true" aria-label="Loading blocked users" className="space-y-3">
          <div className="bg-ink/10 h-10 animate-pulse rounded-sm" />
          <div className="bg-ink/10 h-10 animate-pulse rounded-sm" />
        </div>
      ) : blockedUsers.length === 0 ? (
        <p className="text-ink-body text-base">You have not blocked anyone.</p>
      ) : (
        <ul className="border-hairline border-t">
          {blockedUsers.map((user) => (
            <li
              key={user.id}
              className="border-hairline flex items-center justify-between gap-3 border-b py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="bg-paper-deep text-ink-muted flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl text-sm font-semibold">
                  {user.photoUrl ? (
                    <img src={user.photoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    getAvatarCharacter(user.name)
                  )}
                </span>
                <span className="text-ink truncate text-base font-medium">{user.name}</span>
              </div>
              <button
                type="button"
                onClick={() => onUnblock(user.id)}
                className="text-ink decoration-ink/30 hover:decoration-ink min-h-11 shrink-0 text-base font-semibold underline underline-offset-4 transition-colors duration-200"
              >
                Unblock
              </button>
            </li>
          ))}
        </ul>
      )}
    </CommunityDialog>
  );
}
