import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { communityService } from "@/modules/community/services/community";
import { COMMUNITY_POST_CATEGORIES } from "@/modules/community/types";
import SportsSelect from "@/modules/sports/components/SportsSelect";
import { X, ChevronDown } from "lucide-react";

interface AskQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** Pre-fills the form, e.g. with a question typed on a pathway page. */
  initialTitle?: string;
  initialSport?: string;
}

const MIN_TITLE = 10;
const MIN_BODY = 20;

export default function AskQuestionModal({
  isOpen,
  onClose,
  onSuccess,
  initialTitle,
  initialSport,
}: AskQuestionModalProps) {
  // Seeded once, at mount: the feed renders this modal with the URL already
  // read, so a later reopen keeps whatever draft the parent has typed.
  const [title, setTitle] = useState(initialTitle ?? "");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [sport, setSport] = useState(initialSport ?? "");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("General");
  const [isAnonymous, setIsAnonymous] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  // Length errors only show after a first submit, so nobody is told off while
  // still typing their first sentence.
  const [touched, setTouched] = useState(false);

  const [mounted, setMounted] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock background scroll, enable Escape-to-close, and land in the first
  // required field while the dialog is open.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const focusTimer = window.setTimeout(() => titleRef.current?.focus(), 60);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (title.trim().length < MIN_TITLE || body.trim().length < MIN_BODY) {
      setError("");
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
      setTouched(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "We could not post your question. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const titleShort = touched && title.trim().length < MIN_TITLE;
  const bodyShort = touched && body.trim().length < MIN_BODY;
  const field =
    "text-ink placeholder:text-ink-muted w-full rounded-md border bg-white px-4 text-base transition-colors duration-200 focus:outline-none";
  const fieldOk = "border-[#d9d3c8] hover:border-ink/45 focus:border-ink";
  const fieldBad = "border-red-700 focus:border-red-700";
  const label = "text-ink mb-2 block text-base font-semibold";
  const hint = "text-ink-muted mt-2 text-sm tabular-nums";

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
            className="bg-ink/50 fixed inset-0 z-[200]"
          />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[201] overflow-y-auto"
          >
            <div
              onClick={onClose}
              className="flex min-h-full items-end justify-center sm:items-center sm:p-6"
            >
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="ask-question-title"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 24 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                onClick={(event) => event.stopPropagation()}
                className="bg-paper relative flex w-full max-w-2xl flex-col rounded-t-3xl sm:rounded-3xl"
              >
                <div className="flex items-start justify-between gap-4 px-6 pt-7 sm:px-10 sm:pt-10">
                  <div>
                    <h2
                      id="ask-question-title"
                      className="font-editorial text-ink text-4xl font-light leading-[1.08]"
                    >
                      Ask a question
                    </h2>
                    <p className="text-ink-body mt-3 max-w-[48ch] text-base leading-relaxed">
                      The more specific you are, the faster another parent can help.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="text-ink-body hover:bg-paper-deep hover:text-ink -mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors duration-200"
                  >
                    <X size={20} strokeWidth={1.5} aria-hidden="true" />
                  </button>
                </div>

                <form
                  id="ask-question-form"
                  onSubmit={handleSubmit}
                  noValidate
                  className="flex flex-col gap-7 px-6 py-8 sm:px-10"
                >
                  <div>
                    <label htmlFor="ask-title" className={label}>
                      Your question
                    </label>
                    <input
                      id="ask-title"
                      ref={titleRef}
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={500}
                      aria-invalid={titleShort}
                      aria-describedby="ask-title-hint"
                      placeholder="For example: How do I choose between two academies?"
                      className={`${field} h-12 ${titleShort ? fieldBad : fieldOk}`}
                    />
                    <p
                      id="ask-title-hint"
                      className={`${hint} ${titleShort ? "font-medium text-red-700" : ""}`}
                    >
                      {titleShort
                        ? "Add a little more. A question needs at least 10 characters."
                        : `${title.length} of 500 characters`}
                    </p>
                  </div>

                  <div>
                    <label htmlFor="ask-body" className={label}>
                      Details
                    </label>
                    <textarea
                      id="ask-body"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      maxLength={2000}
                      rows={5}
                      aria-invalid={bodyShort}
                      aria-describedby="ask-body-hint"
                      placeholder="What is your situation? What have you tried? What would a good answer look like?"
                      className={`${field} resize-none py-3 leading-relaxed ${bodyShort ? fieldBad : fieldOk}`}
                    />
                    <p
                      id="ask-body-hint"
                      className={`${hint} ${bodyShort ? "font-medium text-red-700" : ""}`}
                    >
                      {bodyShort
                        ? "Tell us a bit more. Details need at least 20 characters."
                        : `${body.length} of 2000 characters`}
                    </p>
                  </div>

                  <fieldset className="border-hairline border-t pt-6">
                    <legend className="text-ink-muted bg-paper px-2 text-sm font-medium">
                      Optional, but it helps the right people find you
                    </legend>
                    <div className="mt-2 grid gap-6 sm:grid-cols-2">
                      <div>
                        <span className={label}>Sport</span>
                        <SportsSelect
                          value={sport}
                          onChange={setSport}
                          placeholder="Search sport"
                          placement="bottom"
                        />
                      </div>
                      <div>
                        <label htmlFor="ask-category" className={label}>
                          Category
                        </label>
                        <div className="relative">
                          <select
                            id="ask-category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className={`${field} ${fieldOk} h-12 appearance-none pr-10`}
                          >
                            {COMMUNITY_POST_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            size={16}
                            className="text-ink-muted pointer-events-none absolute right-4 top-1/2 -translate-y-1/2"
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="ask-city" className={label}>
                          City
                        </label>
                        <input
                          id="ask-city"
                          type="text"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="For example: Chandigarh"
                          className={`${field} ${fieldOk} h-12`}
                        />
                      </div>
                      <div>
                        <label htmlFor="ask-tags" className={label}>
                          Tags
                        </label>
                        <input
                          id="ask-tags"
                          type="text"
                          value={tags}
                          onChange={(e) => setTags(e.target.value)}
                          placeholder="Separate with commas"
                          className={`${field} ${fieldOk} h-12`}
                        />
                      </div>
                    </div>
                  </fieldset>

                  <label className="flex cursor-pointer items-start gap-4">
                    <input
                      type="checkbox"
                      role="switch"
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={`peer-focus-visible:outline-ink relative mt-0.5 h-6 w-11 shrink-0 rounded-md transition-colors duration-200 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 ${
                        isAnonymous ? "bg-ink" : "bg-[#cfc8bc]"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-[4px] bg-white transition-transform duration-200 ${
                          isAnonymous ? "translate-x-[22px]" : "translate-x-0.5"
                        }`}
                      />
                    </span>
                    <span>
                      <span className="text-ink block text-base font-semibold">
                        Post anonymously
                      </span>
                      <span className="text-ink-body block text-sm">
                        Your name and photo are hidden from other parents.
                      </span>
                    </span>
                  </label>

                  {error ? (
                    <p
                      role="alert"
                      className="rounded-md border border-red-700/30 bg-red-50 px-4 py-3 text-base font-medium text-red-800"
                    >
                      {error}
                    </p>
                  ) : null}
                </form>

                <div className="border-hairline flex shrink-0 flex-col-reverse items-stretch gap-3 border-t px-6 py-5 sm:flex-row sm:items-center sm:justify-end sm:gap-6 sm:px-10">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="text-ink decoration-ink/30 hover:decoration-ink min-h-11 text-base font-semibold underline underline-offset-4 transition-colors duration-200 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="ask-question-form"
                    disabled={isSubmitting}
                    className="btn-motion bg-power-orange-solid inline-flex min-h-12 min-w-[11rem] items-center justify-center rounded-md px-7 text-base font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmitting ? "Publishing" : "Publish question"}
                  </button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
