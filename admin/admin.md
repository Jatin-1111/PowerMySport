# Admin

## What This Project Does
The `admin` project is the internal back-office dashboard for the PowerMySport platform. It is used by platform administrators to monitor platform metrics, manage user safety, approve/reject venue and coach onboarding applications, configure payout methods, and review support tickets and disputes.

## Local Setup
1. **Prerequisites**: Node.js and the `server` project must be running locally.
2. **Install Dependencies**: `npm install` inside the `admin` folder.
3. **Environment Setup**: Copy `.env.example` to `.env.local` (or `.env`).
4. **Run Server**: `npm run dev` starts the admin frontend.

**Required Env Variables**:
- `NEXT_PUBLIC_API_URL`: Points to the backend API (e.g., `http://localhost:5000/api`). Without this, the admin dashboard cannot fetch any data or authenticate users.

## Module Reference

### `src/app/admin`
| File | Purpose | Key Exports | Side Effects |
|------|---------|-------------|--------------|
| `layout.tsx` | Main layout with navigation sidebar for admin pages | `AdminLayout` | Redirects to login if unauthenticated |
| `page.tsx` | The root dashboard displaying high-level metrics | `AdminDashboard` | Fetches overview stats on mount |
| `coaches/page.tsx` | View list of all coaches and their statuses | `AdminCoachesPage` | None |
| `venues/page.tsx` | View list of all venues and their statuses | `AdminVenuesPage` | None |
| `academies/page.tsx` | Moderation queue for academy onboarding | `AdminAcademiesPage`| None |
| `venue-approval/page.tsx` | Moderation panel for venue applications | `AdminVenueApprovalPage`| None |
| `disputes/page.tsx` | Handling user disputes | `AdminDisputesPage` | None |

### `src/components`
| File | Purpose | Key Exports | Side Effects |
|------|---------|-------------|--------------|
| `AdminPageHeader.tsx` | Standardized header component for admin views | `AdminPageHeader` | None |
| `AdminVenueApprovalPanel.tsx` | Complex panel for reviewing venue details | `AdminVenueApprovalPanel`| None |
| `SportsMultiSelect.tsx` | Component to assign sports to venues/coaches | `SportsMultiSelect` | None |
| `CoachOnboardingForm.tsx` | Form for admins to manually onboard a coach | `CoachOnboardingForm` | Redirects upon successful creation |

### `src/services`
| File | Purpose | Key Exports | Side Effects |
|------|---------|-------------|--------------|
| `admin.ts` | Backend API wrapper for admin operations | `adminApi` | Performs Axios HTTP requests |
| `stats.ts` | Backend API wrapper for analytics data | `statsApi` | Performs Axios HTTP requests |

## Key Data Flows

### Venue Approval Flow
1. **List Pending**: The admin navigates to `/admin/venue-approval`, which fetches pending venues using `onboardingApi.getPendingVenues()`.
2. **Review Details**: The admin clicks on a venue to review its documents (GST, PAN) and images.
3. **Action**: The admin clicks "Approve" or "Reject".
4. **Submit**: A request is sent via `onboardingApi.approveVenue` or `onboardingApi.rejectVenue`, updating the venue's status in the database via the backend.

### User Safety / Moderation
1. **List Reports**: Admin visits `/admin/community-reports` to view flagged content or `/admin/user-safety` for user blocks.
2. **Review**: The admin inspects the flagged entity.
3. **Action**: Admin applies an action (Warning, Suspension, Ban) which calls `adminApi.reviewCommunityReport` or `adminApi.updateUserSafetyStatus`.

## State Management
- **Local Component State**: Extensive use of React `useState` for form handling, pagination (e.g., `currentPage`, `totalPages`), search filters, and loading states (`actionLoading`, `loadingOverview`).
- **Global State**: The application primarily uses server-state fetching via Axios. No complex Redux/Zustand global stores were identified; state is passed down as props or fetched per-page.

## API & External Services
- **Backend Server**: Communicates exclusively with the `server` project via the `NEXT_PUBLIC_API_URL`. It uses an `axiosInstance` configured in `src/api/axios.ts` to attach credentials automatically.
- **Authentication**: JWT tokens are handled by the backend and passed via secure HTTP-only cookies, automatically included by Axios (`withCredentials: true`).

## Routes
- `/admin`: Dashboard Home
- `/admin/login`: Admin authentication portal
- `/admin/coaches`: Coach list
- `/admin/venues`: Venue list
- `/admin/academies`: Academy management
- `/admin/disputes`: Dispute resolution
- `/admin/refunds`: Manual refund management
- `/admin/user-safety`: User suspension/bans
- `/admin/stats`: Deep-dive analytics and metrics

## How It Talks to Other Projects
The `admin` project is a standalone Next.js frontend. It communicates with the `server` project using standard HTTP REST API calls via Axios. It does not communicate directly with the `client` or `community` projects, though actions taken here (like banning a user) immediately affect their experience on the other frontends via the shared database.

## Naming & Code Conventions
- Pages are structured using the Next.js 13+ App Router (`app/admin/[route]/page.tsx`).
- Components meant exclusively for admins are prefixed with `Admin` (e.g., `AdminVenueApprovalPanel`, `AdminPageHeader`).
- API calls are encapsulated in typed service files (`src/services/admin.ts`).

## Known Gotchas
- **Session Expiry**: Because auth relies on HTTP-only cookies, an expired session will result in 401 errors from Axios. The admin app usually intercepts these and redirects to `/admin/login`.
- **Image Uploads**: Manual onboarding of coaches/venues requires direct uploads to S3, bypassing standard user workflows, so the admin must ensure images meet size restrictions.
