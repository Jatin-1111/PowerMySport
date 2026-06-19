"use client";

import { useEffect, useState } from "react";
import { Star, MessageCircle, User } from "lucide-react";
import api from "@/lib/api/client";
import { cn } from "@/lib/utils";

export function ProductReviews({ productId }: { productId: string }) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Review form
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, [productId]);

  const fetchReviews = async () => {
    try {
      const res = await api.get(`/v1/products/${productId}/reviews`);
      if (res.data?.ok) {
        setReviews(res.data.data.reviews || []);
        setStats(res.data.data.stats || null);
      }
    } catch (error) {
      console.error("Failed to fetch reviews", error);
    } finally {
      setIsLoading(false);
    }
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError("");
    setSubmitSuccess(false);

    try {
      const res = await api.post(`/v1/products/${productId}/reviews`, {
        rating,
        review: reviewText,
      });

      if (!res.data?.ok) throw new Error(res.data?.error?.message || "Failed to submit review");

      setSubmitSuccess(true);
      setReviewText("");
      fetchReviews(); // Refresh list
    } catch (error: any) {
      setSubmitError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="animate-pulse h-40 bg-slate-100 rounded-2xl" />;

  return (
    <div className="mt-12 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
      <h2 className="text-2xl font-black text-slate-950">Customer Reviews</h2>

      {/* Stats Summary */}
      {stats && (
        <div className="mt-6 flex flex-col md:flex-row gap-8 items-start border-b border-slate-100 pb-8">
          <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-50 p-6 min-w-[200px]">
            <span className="text-5xl font-black text-slate-900">{stats.averageRating.toFixed(1)}</span>
            <div className="mt-2 flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={cn("h-5 w-5", s <= Math.round(stats.averageRating) ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200")}
                />
              ))}
            </div>
            <span className="mt-2 text-sm font-medium text-slate-500">{stats.totalReviews} total reviews</span>
          </div>

          <div className="flex-1 w-full space-y-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = stats.ratingDistribution[star] || 0;
              const percentage = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-3 text-sm font-medium">
                  <span className="w-12 text-slate-600">{star} stars</span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${percentage}%` }} />
                  </div>
                  <span className="w-8 text-right text-slate-500">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_2fr]">
        {/* Write a review form */}
        <div className="rounded-2xl border border-slate-200 p-6 bg-slate-50 self-start sticky top-24">
          <h3 className="font-bold text-slate-900 text-lg">Write a Review</h3>
          <p className="text-sm text-slate-500 mt-1">Share your experience with other athletes. Only verified buyers can leave reviews.</p>
          
          <form onSubmit={submitReview} className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Rating</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => setRating(s)}
                    className="focus:outline-none transition-transform hover:scale-110"
                  >
                    <Star className={cn("h-8 w-8", s <= rating ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200")} />
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Review (optional)</label>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                className="w-full rounded-xl border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-[#ff5722] focus:ring-1 focus:ring-[#ff5722]"
                rows={4}
                placeholder="What did you like or dislike?"
              />
            </div>

            {submitError && <p className="text-sm text-red-500 font-medium">{submitError}</p>}
            {submitSuccess && <p className="text-sm text-emerald-600 font-medium">Review submitted successfully!</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-slate-800 disabled:opacity-50"
            >
              {isSubmitting ? "Submitting..." : "Submit Review"}
            </button>
          </form>
        </div>

        {/* Reviews List */}
        <div className="space-y-6">
          {reviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageCircle className="h-12 w-12 text-slate-200" />
              <h4 className="mt-4 font-bold text-slate-900">No reviews yet</h4>
              <p className="mt-1 text-sm text-slate-500">Be the first to review this product!</p>
            </div>
          ) : (
            reviews.map((rev) => (
              <div key={rev._id} className="border-b border-slate-100 pb-6 last:border-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                      {rev.userId?.photoUrl ? (
                        <img src={rev.userId.photoUrl} alt="Avatar" className="h-full w-full rounded-full object-cover" />
                      ) : (
                        <User className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 flex items-center gap-2">
                        {rev.userId?.name || "Anonymous User"}
                        {rev.isVerified && (
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                            Verified Buyer
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">{new Date(rev.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={cn("h-4 w-4", s <= rev.rating ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200")} />
                    ))}
                  </div>
                </div>
                {rev.review && <p className="mt-4 text-sm leading-relaxed text-slate-600">{rev.review}</p>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
