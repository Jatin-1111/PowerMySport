# PowerMySport - Hyperlocal Sports Venue Booking MVP

A modern full-stack application for discovering and booking sports venues in your locality.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- MongoDB (running locally or Atlas connection string)

### Backend Setup

1. Navigate to the server directory:

```bash
cd server
```

2. Configure environment variables:

```bash
# Copy and modify the .env file
cp .env.example .env
```

Update `.env` with your MongoDB URI and JWT secret:

```
MONGO_URI=mongodb://localhost:27017/powermysport
JWT_SECRET=your_super_secret_jwt_key
PORT=5000
NODE_ENV=development
```

3. Start the backend:

```bash
npm run dev
```

The server will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to the client directory:

```bash
cd client
```

2. Configure environment variables:

```bash
cp .env.example .env.local
```

3. Start the frontend:

```bash
npm run dev
```

The client will run on `http://localhost:3000`

## 📁 Project Structure

### Backend (`/server`)

```
/server
  ├── /src
  │    ├── /config         # Database connection
  │    ├── /controllers    # Request handlers
  │    ├── /middleware     # Auth, validation, error handling
  │    ├── /models         # Mongoose schemas
  │    ├── /routes         # API endpoints
  │    ├── /services       # Business logic
  │    ├── /types          # TypeScript interfaces
  │    ├── /utils          # Helper functions
  │    └── server.ts       # Entry point
```

### Frontend (`/client`)

```
/client/src
 ├── /app
 │    ├── /(auth)          # Login/Register pages
 │    ├── /(dashboard)     # User dashboard
 │    ├── /(marketing)     # Public pages
 │    └── /(vendor)        # Vendor portal
 ├── /components           # Reusable components
 ├── /lib                  # API clients
 ├── /store                # Zustand stores
 ├── /types                # TypeScript definitions
 └── /utils                # Utility functions
```

## 🔌 API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/profile` - Get user profile

### Venues

- `POST /api/venues` - Create venue (vendor only)
- `GET /api/venues/search` - Search venues
- `GET /api/venues/:venueId` - Get venue details
- `GET /api/venues/my-venues` - Get user's venues
- `PUT /api/venues/:venueId` - Update venue
- `DELETE /api/venues/:venueId` - Delete venue

### Bookings

- `POST /api/bookings` - Create booking
- `GET /api/bookings/my-bookings` - Get user's bookings
- `GET /api/bookings/availability/:venueId` - Check availability
- `DELETE /api/bookings/:bookingId` - Cancel booking

## 💡 Key Features

### User Features

- Browse and search sports venues
- Filter by sport type and location
- Real-time slot availability
- Book venues with one-click checkout
- View and manage bookings

### Vendor Features

- Create and manage venues
- View bookings and revenue stats
- Set pricing and amenities
- Manage inventory

### Technical Highlights

- **TypeScript** for type safety
- **Zod** for input validation
- **JWT** authentication with HttpOnly cookies
- **Zustand** for client-side state
- **Axios** with automatic token injection
- **MongoDB** for scalable data storage
- **Error handling** with centralized middleware

## 🔐 Security

- Password hashing with bcryptjs
- JWT tokens stored in HttpOnly cookies
- Zod schema validation on all inputs
- CORS protection
- Role-based access control (user/vendor/admin)

## 📝 Development Notes

### Creating a Booking

The system checks for time slot conflicts before creating a booking:

1. Query existing bookings for the venue on that date
2. Check for overlapping time ranges
3. Calculate total amount based on hours × price per hour
4. Create booking if slot is available

### Time Format

All times use 24-hour format (e.g., "18:00", "19:30")

### Environment Variables Required

**Backend (.env)**

- `MONGO_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT signing
- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment (development/production)
- `FRONTEND_URL` - Frontend URL for CORS

**Frontend (.env.local)**

- `NEXT_PUBLIC_API_URL` - Backend API URL

## 🧪 Testing the Application

1. **Register as User**
   - Go to `/register?role=user`
   - Fill in details and sign up

2. **Register as Vendor**
   - Go to `/register?role=vendor`
   - Create a venue in the inventory

3. **Book a Venue**
   - Search for venues
   - Check availability
   - Complete booking

## 📦 Built With

- **Frontend**: Next.js 14+, TypeScript, Tailwind CSS, Zustand
- **Backend**: Node.js, Express, TypeScript
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT with bcryptjs
- **Validation**: Zod
- **HTTP Client**: Axios

## 📄 License

MIT License

## 👥 Contributing

Contributions are welcome! Please open an issue or submit a pull request.
