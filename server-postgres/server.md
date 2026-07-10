# Server

## What This Project Does
The `server` project is the central backend API for the entire PowerMySport platform. It handles all database operations (MongoDB), caching and rate limiting (Redis), Socket.IO real-time communication, scheduled jobs, integrations (PhonePe, AWS S3, web push, AI), and serves the three frontend applications (`client`, `community`, `admin`).

## Local Setup
1. **Prerequisites**: Node.js, MongoDB (local or Atlas), Redis (running on `localhost:6379`).
2. **Install Dependencies**: `npm install` inside the `server` folder.
3. **Environment Setup**: Copy `.env.example` to `.env` and populate.
4. **Run Server**: `npm run dev` starts the server on port `5000` via nodemon.

**Required Env Variables**:
- `MONGODB_URI`: Database connection string. Without it, the server crashes on boot.
- `JWT_SECRET`: For authentication. Breaks login/signup.
- `REDIS_URL`: Socket.IO adapter & presence. If missing, falls back to single-instance mode.
- `PORT`: Usually 5000.
- `FRONTEND_URLS`, `FRONTEND_URL`: CORS allowed origins.

## Module Reference

### `src/admin`
| File | Purpose | Key Exports | Side Effects |
|------|---------|-------------|--------------|
| `routes/adminRoutes.ts` | Superadmin authentication, user/coach verification APIs | `router` | None |
| `controllers/adminController.ts` | Logic for handling admin requests, coaching approvals | `approveCoachVerification`, etc. | Updates DB user roles |

### `src/client`
| File | Purpose | Key Exports | Side Effects |
|------|---------|-------------|--------------|
| `routes/bookingRoutes.ts` | Booking and checkout APIs | `router` | None |
| `routes/venueRoutes.ts` | Search, discovery, and listing of venues | `router` | None |
| `sockets/bookingSocket.ts` | Real-time lock logic for bookings | `setupBookingSocket` | Locks slots in memory/redis |

### `src/community`
| File | Purpose | Key Exports | Side Effects |
|------|---------|-------------|--------------|
| `routes/communityRoutes.ts` | Groups, DMs, Posts, Answers, Reputations | `router` | None |
| `sockets/communitySocket.ts` | Real-time chat events, presence updates | `setupCommunitySocket` | Broadcasts to active socket rooms |

### `src/config`
| File | Purpose | Key Exports | Side Effects |
|------|---------|-------------|--------------|
| `database.ts` | MongoDB connection setup | `connectDB` | Initializes mongoose connection |
| `redis.ts` | Redis pub/sub client creation | `createRedisPubSub` | Connects to Redis |

### `src/shared`
| File | Purpose | Key Exports | Side Effects |
|------|---------|-------------|--------------|
| `routes/authRoutes.ts` | Auth API: login, signup, reset password, Google OAuth | `router` | None |
| `routes/sportsRoutes.ts` | Static sports definitions and pathways | `router` | None |
| `services/OutboxService.ts` | Reliable message delivery to integrations | `startOutboxWorker` | Spawns background worker |

### `src/utils`
| File | Purpose | Key Exports | Side Effects |
|------|---------|-------------|--------------|
| `scheduledJobs.ts` | Setup cron jobs (cleanup, scraping) | `initializeScheduledJobs` | Starts cron timers |
| `reminderScheduler.ts` | Handles upcoming booking reminders | `initializeReminderScheduler`| Spawns notification timers |

## Key Data Flows

### Booking Flow
1. **Initiate Booking**: UI calls `POST /api/bookings`. `initiateNewBooking` checks availability and creates a `BookingWaitlist` or `BookingSlotLock`.
2. **Payment Trigger**: System triggers `PhonePe` payment gateway integration via `initiatePhonePePaymentForBooking`.
3. **Webhook Callback**: PhonePe hits `/api/payments/phonepe/webhook` which invokes `handlePhonePeCallback`.
4. **Finalize**: The system updates `BookingPaymentTransaction` and sets `Booking` status to `CONFIRMED`.

### Community Chat
1. **Connection**: Client connects to `/community` socket namespace.
2. **Send Message**: `sendMessage` saves to `CommunityMessage` collection.
3. **Broadcast**: `communitySocket.ts` broadcasts the message to the respective room (DM or Group) via Redis Pub/Sub so all instances receive it.

## State Management
- **Persistent State**: MongoDB Atlas (Users, Venues, Coaches, Bookings, Messages, Posts).
- **Ephemeral/Distributed State**: Redis (`BookingSlotLock` locking mechanisms, Socket.IO multi-instance adapter, online presence).
- **In-Memory**: Mongoose connection pools, Socket.IO connected clients list.

## API & External Services
- **PhonePe**: Used for processing payments. Called in `bookingRoutes.ts` and `ecommerceRoutes.ts`. Webhook authenticated via HMAC.
- **AWS S3**: Used for uploading venue images, coach photos, and chat attachments via presigned URLs (`getPresignedUploadUrl`).
- **Nodemailer**: Connects via SMTP (`EMAIL_HOST`/`EMAIL_PORT`/`EMAIL_USER`/`EMAIL_PASSWORD`/`EMAIL_FROM`) for all transactional email. Every message goes through a single `sendEmail()` in `src/utils/email.ts` (which swallows transport errors so mail never breaks a request; some mail is also delivered reliably via the Outbox worker). Templates cover: welcome, password reset, **password-changed confirmation**, booking lifecycle/confirmation/reminder/invitation, friend request + accepted, coach verification (+reminder), credentials (coach/venue/admin), refund, venue onboarding/inquiry, concierge, order confirmation, shop launch, academy onboarding, **support ticket received + status change**, **payout processed**, **dispute raised + resolved**, **booking-waitlist slot available**, **coach subscription purchased + cancelled**, **review received**, and **account suspended/deactivated/reactivated**. Test with `npm run test:email` (mocked) or `npm run email:verify` / `npm run email:test-all -- --send --to you@example.com` (live).
- **Gemini AI**: Used via `@google/genai` to generate/refresh AI sports pathways.

## Routes
- `/api/auth/*`: Shared authentication, Google OAuth.
- `/api/venues/*`: Client venue listing and discovery.
- `/api/bookings/*`: Booking and payment APIs.
- `/api/coaches/*`: Coach discovery and profile management.
- `/api/community/*`: Community feeds, groups, DMs.
- `/api/admin/*`: Admin dashboard metrics and moderation queues.
- `/api/payments/phonepe/*`: Payment webhooks (uses raw body for HMAC).

## How It Talks to Other Projects
The server acts as the central hub. It does not initiate calls to the frontends. It exposes REST endpoints consumed by:
- `client` (Port 3000)
- `community` (Uses sockets and REST APIs)
- `admin` 
It responds with JSON and utilizes CORS configurations to allow access only from these frontends (`FRONTEND_URLS`).

## Naming & Code Conventions
- **Controllers/Routes/Services**: Code follows a strict MVC-like separation (`Route` -> `Controller` -> `Service`).
- **Models**: Mongoose models are placed in `src/models` and strongly typed with TypeScript interfaces extending `Document`.
- **Error Handling**: Uses an `errorHandler` middleware catching thrown `AppError` instances.

## Known Gotchas
- **Redis Requirement**: If Redis is not running locally, Socket.IO silently falls back to single-instance mode (which breaks cross-tab chatting in dev).
- **Trust Proxy**: The app uses `app.set("trust proxy", 1);` which is necessary for rate limiting behind load balancers.
- **Raw Body parsing**: The PhonePe webhook route is registered *before* the global JSON parser to capture raw buffers for webhook signature validation. Adding middleware above it could break payments.
