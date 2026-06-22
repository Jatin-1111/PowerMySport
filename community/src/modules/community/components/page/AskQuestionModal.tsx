import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { communityService } from "@/modules/community/services/community";
import { COMMUNITY_POST_CATEGORIES } from "@/modules/community/types";
import SportsSelect from "@/modules/sports/components/SportsSelect";
import { X, Loader2, MessageCircle, MapPin, AlignLeft, Hash, ChevronDown, EyeOff } from "lucide-react";

interface AskQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AskQuestionModal({
  isOpen,
  onClose,
  onSuccess,
}: AskQuestionModalProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [sport, setSport] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("General");
  const [isAnonymous, setIsAnonymous] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 10 || body.trim().length < 20) {
      setError("Title and details are too short for a quality question.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await communityService.createPost({
        title: title.trim(),
        body: body.trim(),
        tags: tags
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        sport: sport.trim() || undefined,
        city: city.trim() || undefined,
        category: category || "General",
        isAnonymous: isAnonymous || undefined,
      });

      setTitle("");
      setBody("");
      setTags("");
      setSport("");
      setCity("");
      setCategory("General");
      setIsAnonymous(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to post question.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="flex w-full max-w-2xl flex-col rounded-[2rem] bg-white shadow-2xl ring-1 ring-slate-900/5 pointer-events-auto max-h-[95vh]">
              {/* Header */}
              <div className="relative border-b border-slate-100 bg-slate-50/50 px-6 py-5 sm:px-8 sm:py-6 rounded-t-[2rem]">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-title text-xl font-bold tracking-tight text-slate-900">
                      Start a New Question
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Be specific and clear so others can help you quickly.
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-600"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Form Body */}
              <div className="overflow-visible px-6 py-6 sm:px-8">
                <form id="ask-question-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
                  {/* Sport */}
                  <div>
                    <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4 text-turf-green"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                        <path d="M2 12h20" />
                      </svg>
                      Sport (Optional)
                    </label>
                    <div className="[&>div>div:first-child]:py-3 [&>div>div:first-child]:rounded-2xl">
                      <SportsSelect
                        value={sport}
                        onChange={setSport}
                        placeholder="Search sport..."
                        placement="bottom"
                      />
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <MessageCircle size={16} className="text-power-orange" />
                      Question Title *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="What's your question? (min 10 characters)"
                      required
                      className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3.5 text-sm shadow-sm transition focus:border-power-orange/50 focus:outline-none focus:ring-4 focus:ring-power-orange/10"
                    />
                    <p className="mt-1.5 pl-1 text-xs text-slate-400 font-medium">
                      {title.length} / 500 characters
                    </p>
                  </div>

                  {/* Body */}
                  <div>
                    <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <AlignLeft size={16} className="text-purple-500" />
                      Details & Context *
                    </label>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Describe: what's your situation? What have you already tried? What result do you want? (min 20 characters)"
                      rows={5}
                      required
                      className="w-full resize-none rounded-2xl border border-slate-200 bg-white/80 px-4 py-3.5 text-sm shadow-sm transition focus:border-purple-500/50 focus:outline-none focus:ring-4 focus:ring-purple-500/10"
                    />
                    <p className="mt-1.5 pl-1 text-xs text-slate-400 font-medium">
                      {body.length} / 2000 characters
                    </p>
                  </div>

                  {/* Grid for Tags, City */}
                  <div className="grid gap-5 md:grid-cols-2">
                    {/* Tags */}
                    <div>
                      <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Hash size={16} className="text-blue-500" />
                        Tags (Optional)
                      </label>
                      <input
                        type="text"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        placeholder="e.g. fitness, diet"
                        className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm shadow-sm transition focus:border-blue-500/50 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                      />
                    </div>

                    {/* City */}
                    <div>
                      <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <MapPin size={16} className="text-rose-500" />
                        City (Optional)
                      </label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="e.g. New York, NY"
                        className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm shadow-sm transition focus:border-rose-500/50 focus:outline-none focus:ring-4 focus:ring-rose-500/10"
                      />
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <ChevronDown size={16} className="text-violet-500" />
                      Category
                    </label>
                    <div className="relative">
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full appearance-none rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm shadow-sm transition focus:border-violet-500/50 focus:outline-none focus:ring-4 focus:ring-violet-500/10 pr-10"
                      >
                        {COMMUNITY_POST_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>

                  {/* Anonymous Toggle */}
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={isAnonymous}
                        onChange={(e) => setIsAnonymous(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`h-5 w-9 rounded-full transition-colors ${isAnonymous ? "bg-slate-700" : "bg-slate-300"}`} />
                      <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${isAnonymous ? "translate-x-4" : "translate-x-0.5"}`} />
                    </div>
                    <div className="flex items-center gap-2">
                      <EyeOff size={15} className="text-slate-500" />
                      <span className="text-sm font-semibold text-slate-800">Post Anonymously</span>
                      <span className="text-xs text-slate-500">— your name will be hidden</span>
                    </div>
                  </label>

                  {error && (
                    <div className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600">
                      {error}
                    </div>
                  )}
                </form>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4 sm:px-8 sm:py-5 flex items-center justify-end gap-3 rounded-b-[2rem] shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="rounded-2xl px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="ask-question-form"
                  disabled={isSubmitting}
                  className="inline-flex min-w-[150px] items-center justify-center gap-2 rounded-2xl bg-power-orange px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-power-orange/20 transition hover:bg-[#d96610] focus:outline-none focus:ring-4 focus:ring-power-orange/20 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    "Publish Question"
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
