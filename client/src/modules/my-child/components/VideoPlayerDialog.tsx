"use client";

import { childHistoryApi } from "@/modules/my-child/services/childHistory";
import { Modal } from "@/modules/shared/ui/Modal";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { useQuery } from "@tanstack/react-query";

/**
 * Plays one of the parent's own clips. The link is fetched when the dialog opens and is good for
 * a few minutes, so it is never kept: it is asked for again each time.
 */
export function VideoPlayerDialog({
  childId,
  video,
  onClose,
}: {
  childId: string;
  video: { id: string; title?: string } | null;
  onClose: () => void;
}) {
  const playback = useQuery({
    queryKey: ["child-video-playback", childId, video?.id],
    queryFn: () => childHistoryApi.videoPlayback(childId, video!.id),
    enabled: video !== null,
    gcTime: 0,
    staleTime: 0,
  });

  return (
    <Modal isOpen={video !== null} onClose={onClose} title={video?.title ?? "Video"} size="xl">
      {playback.isPending && <Skeleton className="aspect-video w-full rounded-xl" />}
      {playback.isError && (
        <p role="alert" className="text-ink-body">
          This video could not be played. Close this and try again.
        </p>
      )}
      {playback.data && (
        <video
          key={playback.data.url}
          src={playback.data.url}
          controls
          playsInline
          autoPlay
          className="aspect-video w-full rounded-xl bg-black"
        >
          Your browser cannot play this video.
        </video>
      )}
    </Modal>
  );
}
