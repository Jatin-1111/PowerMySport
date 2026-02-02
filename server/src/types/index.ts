// User Types
export interface IUser {
  id?: string;
  name: string;
  email: string;
  phone: string;
  role: "user" | "vendor" | "admin";
  password: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUserPayload {
  id: string;
  email: string;
  role: "user" | "vendor" | "admin";
}

// Venue Types
export interface IVenue {
  id?: string;
  name: string;
  ownerId: string;
  location: string;
  sports: string[];
  pricePerHour: number;
  amenities: string[];
  description: string;
  images: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

// Booking Types
export interface IBooking {
  id?: string;
  userId: string;
  venueId: string;
  date: Date;
  startTime: string; // "18:00"
  endTime: string; // "19:00"
  totalAmount: number;
  status: "confirmed" | "cancelled";
  paymentStatus: "pending" | "paid";
  createdAt?: Date;
  updatedAt?: Date;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

export interface AuthResponse {
  token: string;
  user: IUser;
}
