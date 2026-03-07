# PowerMySport Development Setup

## 🚀 Quick Start

Run this single command from the root directory:

```powershell
.\dev-single.ps1
```

This will start all 4 services simultaneously:

- **Server** (Backend API): http://localhost:5000
- **Client** (Main App): http://localhost:3000
- **Admin** (Admin Panel): http://localhost:3001
- **Community** (Community App): http://localhost:3002

**Note:** First-time compilation takes 30-60 seconds. Wait until all apps show "compiled successfully" before accessing them.

## Alternative: Separate Windows

If you prefer each service in its own window:

```powershell
.\dev.ps1
```

## Testing Endpoints

Run the test script to verify all services:

```powershell
.\test-endpoints.ps1
```

## ✅ Test Results

All endpoints are working:

### Frontend Services

- ✓ Client (3000) - Running
- ✓ Admin (3001) - Running
- ✓ Community (3002) - Running

### Backend API Endpoints

- ✓ Auth API (Register, Login, Profile, Logout)
- ✓ Venue API (Discover, Search, My Venues)
- ✓ Coach API (My Profile)
- ✓ Booking API (My Bookings)
- ✓ Geo API (Autocomplete, Geocode)
- ✓ Sports API (Get Sports)
- ✓ Community API (Profile, Conversations)

## Stopping Services

Press `Ctrl+C` in the terminal running `dev-single.ps1` to stop all services.

## Port Configuration

- Server: 5000 (configured in server code)
- Client: 3000 (Next.js default)
- Admin: 3001 (passed via --port flag)
- Community: 3002 (passed via --port flag)
