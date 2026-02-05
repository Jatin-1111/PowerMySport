# PowerMySport - Backend API Integration Documentation

## ⚠️ CRITICAL: DO NOT MODIFY THESE INTEGRATIONS DURING REFACTOR

This document maps all existing backend API integrations that MUST be preserved during the UI refactoring process.

---

## 📡 Base Configuration

**API Base URL**: `http://localhost:5000/api`  
**Authentication**: JWT tokens (stored in localStorage and cookies)  
**Axios Instance**: `client/src/lib/axios.ts`

### Axios Interceptors

- **Request**: Automatically attaches JWT token from localStorage
- **Response**: Handles 401 errors by clearing auth and redirecting to login

---

## 🔐 Authentication APIs (`/api/auth`)

### Client Library: `client/src/lib/auth.ts`

| Endpoint                | Method | Purpose                     | Request Data                                 | Response               |
| ----------------------- | ------ | --------------------------- | -------------------------------------------- | ---------------------- |
| `/auth/register`        | POST   | User registration           | `{ name, email, phone, password, role }`     | `{ token, user }`      |
| `/auth/login`           | POST   | User login                  | `{ email, password }`                        | `{ token, user }`      |
| `/auth/logout`          | POST   | User logout                 | -                                            | `{ success, message }` |
| `/auth/profile`         | GET    | Get user profile            | -                                            | `{ user }`             |
| `/auth/forgot-password` | POST   | Request password reset      | `{ email }`                                  | `{ resetToken }`       |
| `/auth/reset-password`  | POST   | Reset password              | `{ token, newPassword }`                     | `{ success }`          |
| `/auth/google`          | POST   | Google OAuth login/register | `{ googleId, email, name, photoUrl, role? }` | `{ token, user }`      |

**Used In**:

- `client/src/app/(auth)/login/page.tsx`
- `client/src/app/(auth)/register/page.tsx`
- `client/src/app/(auth)/forgot-password/page.tsx`
- `client/src/app/(auth)/reset-password/page.tsx`
- `client/src/app/dashboard/my-profile/page.tsx`
- `client/src/app/dashboard/layout.tsx`
- `client/src/app/venue-lister/layout.tsx`

---

## 🏟️ Venue APIs (`/api/venues`)

### Client Library: `client/src/lib/venue.ts`

| Endpoint            | Method | Purpose                          | Authentication          | Request Data                                                                     |
| ------------------- | ------ | -------------------------------- | ----------------------- | -------------------------------------------------------------------------------- |
| `/venues`           | POST   | Create venue                     | Required (VENUE_LISTER) | `{ name, location, sports[], pricePerHour, amenities[], description, images[] }` |
| `/venues/:venueId`  | GET    | Get venue details                | No                      | -                                                                                |
| `/venues/my-venues` | GET    | Get owner's venues               | Required (VENUE_LISTER) | -                                                                                |
| `/venues/:venueId`  | PUT    | Update venue                     | Required (VENUE_LISTER) | Partial venue data                                                               |
| `/venues/:venueId`  | DELETE | Delete venue                     | Required (VENUE_LISTER) | -                                                                                |
| `/venues/search`    | GET    | Search venues                    | No                      | Query params: `sports[], location`                                               |
| `/venues/discover`  | GET    | Discover nearby venues & coaches | No                      | Query params: `latitude, longitude, maxDistance, sport`                          |

**Used In**:

- `client/src/app/venue-lister/inventory/page.tsx`
- `client/src/app/venue-lister/page.tsx`
- `client/src/app/dashboard/search/page.tsx`
- `client/src/app/dashboard/book/[venueId]/page.tsx`
- `client/src/app/dashboard/discover/page.tsx`

---

## 📅 Booking APIs (`/api/bookings`)

### Client Library: `client/src/lib/booking.ts`

| Endpoint                          | Method | Purpose                              | Authentication | Request Data                                       |
| --------------------------------- | ------ | ------------------------------------ | -------------- | -------------------------------------------------- |
| `/bookings/initiate`              | POST   | Initiate booking with split payments | Required       | `{ venueId, coach Id?, date, startTime, endTime }` |
| `/bookings/mock-payment`          | POST   | Process mock payment (testing)       | No             | `{ bookingId, userId, userType }`                  |
| `/bookings/webhook`               | POST   | Payment webhook handler              | No             | Payment gateway webhook data                       |
| `/bookings/verify/:token`         | GET    | Verify booking with QR code          | No             | URL param: token                                   |
| `/bookings/my-bookings`           | GET    | Get user's bookings                  | Required       | -                                                  |
| `/bookings/availability/:venueId` | GET    | Get venue availability               | No             | Query param: date                                  |
| `/bookings/:bookingId`            | DELETE | Cancel booking                       | Required       | -                                                  |

**Used In**:

- `client/src/app/dashboard/book/[venueId]/page.tsx`
- `client/src/app/dashboard/my-bookings/page.tsx`
- `client/src/app/venue-lister/vendor-bookings/page.tsx`
- `client/src/app/venue-lister/page.tsx`
- `client/src/app/coach/my-bookings/page.tsx`

**Special Features**:

- Split payment system (venue + coach)
- QR code generation for verification
- Automatic booking expiration (15 minutes for payment)
- Payment webhook integration

---

## 🎾 Coach APIs (`/api/coaches`)

### Client Library: `client/src/lib/coach.ts`

| Endpoint                         | Method | Purpose                          | Authentication   | Request Data                                                                                                                  |
| -------------------------------- | ------ | -------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `/coaches`                       | POST   | Create coach profile             | Required (COACH) | `{ bio, certifications[], sports[], hourlyRate, serviceMode, venueId?, serviceRadiusKm?, travelBufferTime?, availability[] }` |
| `/coaches/my-profile`            | GET    | Get current user's coach profile | Required (COACH) | -                                                                                                                             |
| `/coaches/:coachId`              | GET    | Get coach by ID                  | No               | -                                                                                                                             |
| `/coaches/:coachId`              | PUT    | Update coach profile             | Required (COACH) | Partial coach data                                                                                                            |
| `/coaches/:coachId`              | DELETE | Delete coach profile             | Required (COACH) | -                                                                                                                             |
| `/coaches/availability/:coachId` | GET    | Check coach availability         | No               | -                                                                                                                             |

**Used In**:

- `client/src/app/coach/profile/page.tsx`
- `client/src/app/dashboard/discover/page.tsx` (via discovery API)

**Service Modes**:

- `OWN_VENUE`: Coach operates at their own venue
- `FREELANCE`: Coach travels to client locations
- `HYBRID`: Both options available

---

## 📝 Venue Inquiry APIs (`/api/venue-inquiries`)

### Client Library: `client/src/lib/venueInquiry.ts`

| Endpoint                      | Method | Purpose                | Authentication   | Request Data                                                 |
| ----------------------------- | ------ | ---------------------- | ---------------- | ------------------------------------------------------------ |
| `/venue-inquiries/submit`     | POST   | Submit venue inquiry   | No               | `{ venueName, ownerName, phone, address, sports, message? }` |
| `/venue-inquiries`            | GET    | Get all inquiries      | Required (ADMIN) | Query param: status                                          |
| `/venue-inquiries/:id`        | GET    | Get inquiry by ID      | Required (ADMIN) | -                                                            |
| `/venue-inquiries/:id/review` | PUT    | Approve/reject inquiry | Required (ADMIN) | `{ status, reviewNotes? }`                                   |
| `/venue-inquiries/:id`        | DELETE | Delete inquiry         | Required (ADMIN) | -                                                            |

**Used In**:

- `client/src/app/venue-inquiry/page.tsx`
- `client/src/app/admin/inquiries/page.tsx`

**Special Logic**:

- Email auto-generated from phone: `venue_[phone]@powermysport.com`
- Approved inquiries automatically create VENUE_LISTER account
- First venue automatically created on approval
- `canAddMoreVenues` set to false (restriction)

---

## 👨‍💼 Admin APIs (`/api/admin`)

### Client Library: `client/src/lib/admin.ts`

| Endpoint         | Method | Purpose           | Authentication         | Request Data                       |
| ---------------- | ------ | ----------------- | ---------------------- | ---------------------------------- |
| `/admin/login`   | POST   | Admin login       | No                     | `{ email, password }`              |
| `/admin/logout`  | POST   | Admin logout      | Required (ADMIN)       | -                                  |
| `/admin/profile` | GET    | Get admin profile | Required (ADMIN)       | -                                  |
| `/admin/create`  | POST   | Create new admin  | Required (SUPER_ADMIN) | `{ name, email, password, role? }` |
| `/admin/list`    | GET    | List all admins   | Required (SUPER_ADMIN) | -                                  |

**Used In**:

- `client/src/app/admin/login/page.tsx`
- `client/src/app/admin/**/*.tsx`

---

## 📊 Stats APIs (`/api/stats`)

### Client Library: `client/src/lib/stats.ts`

| Endpoint          | Method | Purpose                 | Authentication   | Response Data                                                            |
| ----------------- | ------ | ----------------------- | ---------------- | ------------------------------------------------------------------------ |
| `/stats/platform` | GET    | Get platform statistics | Required (ADMIN) | `{ totalUsers, total Venues, totalBookings, pendingInquiries, revenue }` |
| `/stats/users`    | GET    | Get all users           | Required (ADMIN) | Array of users                                                           |
| `/stats/venues`   | GET    | Get all venues          | Required (ADMIN) | Array of venues                                                          |
| `/stats/bookings` | GET    | Get all bookings        | Required (ADMIN) | Array of bookings                                                        |

**Used In**:

- `client/src/app/admin/page.tsx`
- `client/src/app/admin/users/page.tsx`
- `client/src/app/admin/venues/page.tsx`
- `client/src/app/admin/bookings/page.tsx`

---

## 🔒 Authentication Middleware

### Server: `server/src/middleware/auth.ts`

**authMiddleware**: Validates JWT token from cookies or Authorization header  
**vendorMiddleware**: Ensures user has VENUE_LISTER role  
**adminMiddleware**: Ensures user has ADMIN role

---

## 🗂️ State Management

### Zustand Stores

**authStore** (`client/src/store/authStore.ts`):

- Manages user authentication state
- Stores: user, token, loading, error
- Actions: setUser, setToken, setLoading, setError, logout

**venueStore** (`client/src/store/venueStore.ts`):

- Manages venue data
- Used across venue-related pages

**bookingStore** (`client/src/store/bookingStore.ts`):

- Manages booking state
- Handles booking flow data

---

## 🚨 INTEGRATION PRESERVATION CHECKLIST

When refactoring, ensure:

✅ All API endpoint paths remain unchanged  
✅ Request/response data structures preserved  
✅ Authentication flows intact (JWT, Google OAuth)  
✅ Zustand store structure maintained  
✅ Axios interceptors functional  
✅ Error handling preserved  
✅ Role-based access control working  
✅ Payment integration (split payments) functional  
✅ QR code generation/verification working  
✅ Email auto-generation logic preserved  
✅ Booking expiration job functional  
✅ All middleware validations active

---

## 📋 Testing Requirements Post-Refactor

1. **Authentication Flow**
   - Register new user (regular + Google OAuth)
   - Login/logout
   - Password reset flow
   - Role-based redirects

2. **Venue Management**
   - Create/read/update/delete venues
   - Search and discovery
   - Venue inquiry submission and approval

3. **Booking Flow**
   - Initiate booking
   - Mock payment processing
   - View bookings
   - Cancel booking
   - QR verification

4. **Coach Features**
   - Create coach profile
   - Update availability
   - Book with coach
   - View coach bookings

5. **Admin Features**
   - View platform stats
   - Manage inquiries
   - Approve/reject venue requests
   - View all users/venues/bookings

---

**Last Updated**: February 6, 2026  
**Status**: Pre-Refactor Documentation
