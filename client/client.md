# Client

## What This Project Does
The `client` project is the main consumer-facing web application of the PowerMySport platform. It allows players (and parents) to discover sports venues, find coaches, book sessions, manage their wallet and subscriptions, and checkout. It also provides dashboards for "Venue Listers" and "Coaches" to manage their inventory, availability, and payouts.

## Local Setup
1. **Prerequisites**: Node.js and the `server` project must be running locally.
2. **Install Dependencies**: `npm install` inside the `client` folder.
3. **Environment Setup**: Copy `.env.local` (or create one).
4. **Run Server**: `npm run dev` starts the client frontend.

**Required Env Variables**:
- `NEXT_PUBLIC_API_URL`: Base URL for the backend API (e.g., `http://localhost:5000/api`). Without this, no data can be fetched and auth will fail.
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: Required for Google OAuth login on the frontend.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: Required for push notifications.
- `NEXT_PUBLIC_SHOP_IS_LIVE`: Feature flag to enable/disable the e-commerce shop.
- `NEXT_PUBLIC_BOOKING_IS_LIVE`: Feature flag to show/hide the "Book" (venues/coaches/academies) nav entry.

## Module Reference

### `src/app`
| File | Purpose | Key Exports | Side Effects |
|------|---------|-------------|--------------|
| `(auth)/*` | Login, Register, Forgot Password | Various Pages | Uses cookies for session |
| `coaches/*` | Search, discover, and view coach profiles | `CoachesPage` | None |
| `venues/*` | Search, discover, and view venue profiles | `VenuesPage` | None |
| `dashboard/*` | User dashboard for bookings, profile, friends | `DashboardPage` | Protected by auth |
| `coach/*` | Coach-specific dashboard (verification, billing) | `CoachVerificationPage` | Protected by auth |
| `venue-lister/*` | Venue Lister dashboard (inventory, payouts) | `VenueListerDashboard` | Protected by auth |
| `academy/*` | Academy onboarding and profile | `AcademyDashboardPage`| None |
| `(shop)/*` | E-commerce catalog, cart, orders | `ShopCatalogClient` | None |

### `src/components`
| File | Purpose | Key Exports | Side Effects |
|------|---------|-------------|--------------|
| `CheckoutShell.tsx` | UI Shell for the checkout experience | `CheckoutShell` | None |
| `PaymentMethodSelector.tsx` | Allows choosing PhonePe vs Wallet | `PaymentMethodSelector`| None |
| `ProfilePictureUpload.tsx` | User profile avatar uploads | `ProfilePictureUpload`| Uploads directly to S3 |

### `src/services`
| File | Purpose | Key Exports | Side Effects |
|------|---------|-------------|--------------|
| `venue.ts` | API wrapper for venue data | `venueApi` | HTTP requests |
| `booking.ts` | API wrapper for bookings & waitlists | `bookingApi` | HTTP requests |
| `ecommerce.ts` | API wrapper for the shop | `ecommerceApi` | HTTP requests |

## Key Data Flows

### Booking & Checkout Flow
1. **Selection**: User selects a slot on a Venue or Coach profile and clicks Book.
2. **Checkout Page**: User is redirected to `/dashboard/checkout?params...`. `CheckoutClient.tsx` loads the details.
3. **Payment**: User selects a payment method (e.g., PhonePe). `bookingApi.initiatePayment` is called.
4. **Redirect**: User is redirected to PhonePe. Upon success, they are redirected back to the app (`/dashboard/bookings/[id]?success=true`).

### Coach Verification
1. **Initiate**: Coach signs up and visits `/coach/verification`.
2. **Forms**: They complete a multi-step form (`Step1BasicInfo`, `Step2Location`, `Step3Legal`).
3. **Uploads**: Legal documents (PAN, GST) and profile photos are uploaded via presigned S3 URLs (`onboardingApi.getCoachPhotoUploadUrl`).
4. **Submit**: `adminApi.submitCoachVerificationAdminHandler` (via backend) marks them as Pending until an Admin approves.

## State Management
- **Local Component State**: Heavy use of React `useState` for complex multi-step forms (e.g., `AcademyOnboardingContainer`, `CheckoutClient`).
- **Data Fetching State**: Local states like `isLoading`, `isSubmitting`, `loadingSlots` are used per-page to show skeletons and spinners.
- **Form Data**: Objects like `formData` or `profileForm` are managed via local state.

## API & External Services
- **Backend Server**: Communicates with the `server` project via `NEXT_PUBLIC_API_URL` using an Axios instance (`src/api/axios.ts`).
- **Google OAuth**: Uses `NEXT_PUBLIC_GOOGLE_CLIENT_ID` for frontend authentication flows before exchanging tokens with the backend.
- **Web Push**: Uses `NEXT_PUBLIC_VAPID_PUBLIC_KEY` to subscribe the user's browser to web push notifications (`useNotifications.ts`).

## Routes
- `/` - Marketing homepage
- `/login`, `/register` - Authentication
- `/venues`, `/coaches` - Discovery directories
- `/dashboard/my-bookings` - Player's past and upcoming bookings
- `/dashboard/wallet` - Wallet balance and top-up
- `/dashboard/checkout` - Unified checkout for bookings
- `/venue-lister/inventory` - Venue owner dashboard
- `/coach/verification` - Coach onboarding
- `/academy/onboarding` - Academy setup workflow
- `/shop` - E-commerce store

## How It Talks to Other Projects
The `client` application communicates exclusively with the `server` project's REST API. It does not communicate directly with the `admin` or `community` frontends. The authentication session is shared across subdomains via HTTP-only cookies (configured by the backend).

## Naming & Code Conventions
- Uses Next.js App Router conventions (`layout.tsx`, `page.tsx`).
- Route groups are used to share layouts (e.g., `(auth)`, `(shop)`, `(marketing)`).
- Client components that require heavy state are often extracted with a `Client` suffix (e.g., `ShopCatalogClient.tsx`) so the main `page.tsx` can remain a Server Component if needed.

## Known Gotchas
- **CORS & Cookies**: For local development, if you access the client via `127.0.0.1` instead of `localhost`, cookies might not attach correctly because the backend explicitly allows `localhost` origins.
- **PhonePe Redirection**: The checkout flow relies on external redirects. If testing locally, PhonePe sandbox callbacks might not reach your local machine without a tunnel (like ngrok).

## 404 / Not Found
A custom `src/app/not-found.tsx` renders for unmatched routes, styled to match the client marketing/brand look (Syne heading, power-orange CTAs) with "Back to home" and "Explore venues & coaches" links.
