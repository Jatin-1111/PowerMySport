import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email format"),
  phone: z.string().min(1, "Phone number is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z
    .enum(["PLAYER", "VENUE_LISTER", "COACH"])
    .optional()
    .default("PLAYER"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export const venueSchema = z.object({
  name: z.string().min(1, "Venue name is required"),
  location: z.string().min(1, "Location is required"),
  sports: z.array(z.string()).min(1, "At least one sport is required"),
  pricePerHour: z.number().min(0, "Price must be non-negative"),
  amenities: z.array(z.string()).optional().default([]),
  description: z.string().optional().default(""),
  images: z.array(z.string()).optional().default([]),
});

export const bookingSchema = z.object({
  venueId: z.string().min(1, "Venue ID is required"),
  date: z.string().datetime(),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Start time must be in HH:mm format"),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "End time must be in HH:mm format"),
});
