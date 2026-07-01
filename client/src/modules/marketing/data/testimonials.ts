import type { Testimonial } from "@/modules/marketing/components/marketing/Testimonials";

/**
 * Single source of truth for parent testimonials, shared across the homepage
 * testimonials grid, the trust marquee, and the About page spotlight.
 */
export const parentTestimonials: Testimonial[] = [
  {
    quote:
      "I had no idea where to start with my daughter's badminton. The roadmap laid out exactly what to focus on at her age. For the first time, I actually feel in control instead of guessing.",
    author: "Anjali Patel",
    role: "Mother of 2 · Badminton",
    rating: 5,
  },
  {
    quote:
      "Everyone gives you different advice about kids' sports. Getting clear guidance built around my son's age and goals saved me weeks of second-guessing. It just made sense.",
    author: "Meera Krishnan",
    role: "Parent · Bengaluru",
    rating: 5,
  },
  {
    quote:
      "My son wanted to try four different sports before we figured out swimming was his thing. The roadmap helped me understand what actually suited his age and temperament. Saved us months of trial and error.",
    author: "Rohit Malhotra",
    role: "Father of 1 · Swimming",
    rating: 5,
  },
];
