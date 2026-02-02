// User Types
export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "user" | "vendor" | "admin";
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    token: string;
    user: User;
  };
}

// Venue Types
export interface Venue {
  id: string;
  name: string;
  ownerId: string;
  location: string;
  sports: string[];
  pricePerHour: number;
  amenities: string[];
  description: string;
  images: string[];
  createdAt: string;
  updatedAt: string;
}

// Booking Types
export interface Booking {
  id: string;
  userId: string;
  venueId: string;
  date: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
  status: "confirmed" | "cancelled";
  paymentStatus: "pending" | "paid";
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

export interface Availability {
  availableSlots: string[];
  bookedSlots: Array<{
    startTime: string;
    endTime: string;
  }>;
}
