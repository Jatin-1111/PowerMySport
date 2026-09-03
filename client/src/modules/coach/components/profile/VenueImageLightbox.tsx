import { X } from "lucide-react";

export function VenueImageLightbox({
  imageUrl,
  onClose,
}: {
  imageUrl: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4"
      onClick={onClose}
    >
      <div className="relative w-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 z-10 rounded-full bg-white/95 p-2 text-slate-800 shadow-sm transition-colors hover:bg-white"
          aria-label="Close image preview"
        >
          <X size={18} />
        </button>
        <img
          src={imageUrl}
          alt="Venue image preview"
          className="max-h-[85vh] w-full rounded-xl object-contain"
        />
      </div>
    </div>
  );
}
