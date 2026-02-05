# PowerMySport - Business Analysis & User Journeys

## 🎯 Business Model

### Platform Type

**Three-Sided Marketplace** connecting:

1. **Players/Athletes** - End users who book facilities and coaching
2. **Venue Owners** - List and monetize sports facilities
3. **Coaches** - Offer coaching services (venue-based, freelance, or hybrid)

### Revenue Model

- Commission-based marketplace
- Split payment system (venue + coach fees separated)
- Platform handles booking, payment processing, and verification

---

## 👥 User Roles & Complete Journeys

### 1. 🎮 PLAYER/ATHLETE Journey

**Discovery Phase**:

- Land on homepage → See hero with "Book Now" CTA
- Browse featured venues and coaches
- Use geo-location discovery to find nearby options
- Filter by sport type, price, location

**Registration/Login**:

- Register as PLAYER via `/register?role=PLAYER`
- Option for Google OAuth quick signup
- Email verification and password management

**Booking Flow**:

1. Search venue by location/sport (`/dashboard/discover`)
2. View venue details, amenities, pricing
3. Select date and time slot
4. Optional: Add coach to booking
5. Review total cost (venue + coach split shown)
6. Complete payment
7. Receive QR code for venue entry

**Post-Booking**:

- View bookings in dashboard (`/dashboard/my-bookings`)
- Cancel bookings if needed
- Present QR code at venue for verification
- Track payment history

**Dashboard Access**: `/dashboard/*`

- Discover (search & book)
- My Bookings
- My Profile

---

### 2. 🏟️ VENUE OWNER/LISTER Journey

**Onboarding**:

- Submit venue inquiry via `/venue-inquiry` (no account needed)
- Provide: venue name, phone, address, sports offered
- Wait for admin approval (24-48 hours)
- Receive auto-generated email credentials: `venue_[phone]@powermysport.com`

**Post-Approval**:

- Login with provided credentials
- First venue automatically created from inquiry
- **Restriction**: Can only manage approved venue (cannot add more)
- Update venue details (pricing, amenities, images, availability)

**Operations**:

- View incoming bookings (`/venue-lister/vendor-bookings`)
- Verify customer QR codes
- Track revenue from confirmed bookings
- Update venue information

**Dashboard Access**: `/venue-lister/*`

- Inventory (manage venue)
- Vendor Bookings
- Profile settings

---

### 3. 🎾 COACH Journey

**Registration**:

- Register via `/register?role=COACH` or "Become a Coach" CTA
- Complete profile setup post-registration
- Choose service mode:
  - **OWN_VENUE**: Operate at specific venue
  - **FREELANCE**: Travel to any location
  - **HYBRID**: Both options available

**Profile Setup** (`/coach/profile`):

- Bio and certifications
- Sports expertise
- Hourly rate
- Service area/radius (if freelance)
- Availability schedule (days/times)

**Operations**:

- Appear in discovery results for players
- Get booked alongside venue reservations
- Receive commission from bookings
- Manage schedule and availability

**Dashboard Access**: `/coach/*`

- Profile management
- My Bookings
- Availability settings

---

### 4. 👨‍💼 ADMIN Journey

**Access**:

- Separate admin login (`/admin/login`)
- Super admin can create additional admins
- Role-based permissions (ADMIN vs SUPER_ADMIN)

**Key Responsibilities**:

1. **Venue Inquiry Management** (`/admin/inquiries`)
   - Review pending venue applications
   - Approve/reject with notes
   - Auto-creates venue lister account on approval

2. **Platform Oversight** (`/admin`)
   - View dashboard statistics
   - Monitor total users, venues, bookings
   - Track platform revenue

3. **User Management** (`/admin/users`)
   - View all registered users
   - Manage user roles and status

4. **Venue Management** (`/admin/venues`)
   - Oversee all listed venues
   - Moderate content

5. **Booking Management** (`/admin/bookings`)
   - View all bookings
   - Handle disputes
   - Monitor payment status

**Dashboard Access**: `/admin/*`

---

## 🔄 Key Platform Workflows

### Workflow 1: Venue Inquiry → Approval → Operations

```
User submits inquiry (no account)
    ↓
Admin reviews in queue
    ↓
[APPROVED] → System creates:
    - User account (auto-generated email)
    - First venue entry
    - Sets canAddMoreVenues = false
    ↓
Admin sends credentials to user
    ↓
Venue owner logs in and manages venue
```

### Workflow 2: Player Books Venue + Coach

```
Player searches venues
    ↓
Selects venue + time slot
    ↓
Optionally adds coach
    ↓
System calculates split payment:
    - Venue fee
    - Coach fee (if applicable)
    - Platform commission
    ↓
Player completes payment
    ↓
System creates booking:
    - Generates QR code
    - Notifies venue owner
    - Notifies coach (if booked)
    - Starts 15-min expiration timer
    ↓
Player receives confirmation + QR code
    ↓
Player visits venue → Scans QR → Verified entry
```

### Workflow 3: Booking Expiration

```
Booking initiated → 15-minute timer starts
    ↓
If payment not completed within 15 min:
    - Booking status → EXPIRED
    - Slot released for others
    ↓
Background job checks expired bookings
```

---

## 🎨 Current UX/UI Issues Identified

### Problems to Fix in Refactor:

1. **Inconsistent Branding**
   - No unified color scheme across pages
   - Various button styles
   - Inconsistent spacing and typography

2. **Poor Navigation**
   - No global navigation bar
   - Hard to navigate between user roles
   - Missing breadcrumbs

3. **Weak Homepage**
   - Minimal content
   - No compelling hero section
   - Missing trust signals
   - No social proof

4. **Missing Pages**
   - No About Us page
   - No Services explanation page
   - No Contact page
   - No FAQ section

5. **Mobile Responsiveness**
   - Some pages not fully responsive
   - Touch targets too small
   - Forms challenging on mobile

6. **Accessibility**
   - Missing ARIA labels
   - Poor keyboard navigation
   - Insufficient color contrast in places

---

## 🎯 Refactor Goals

### Design System Goals:

- ✅ Consistent color palette (use existing Tailwind theme)
- ✅ Unified typography scale
- ✅ Reusable component library
- ✅ Responsive-first approach
- ✅ Accessible by default (WCAG 2.1 AA)

### New Pages to Create:

1. **Home** - Compelling hero, features, testimonials, CTA
2. **About Us** - Mission, vision, team, story
3. **Services** - Detailed breakdowns for each user type
4. **How It Works** - Step-by-step guides
5. **Contact** - Multiple contact methods
6. **FAQ** - Common questions organized by user type

### Component Library:

- Button variants (primary, secondary, ghost, danger)
- Card components
- Form inputs with validation
- Navigation bar
- Footer
- Hero sections
- Feature grids
- Testimonial cards
- Stats counters

---

## 📊 Success Metrics

Post-refactor, we should see improvements in:

- **User Engagement**: Time on site, pages per session
- **Conversion Rates**: Registration completions, booking completions
- **User Satisfaction**: Reduced bounce rate, better task completion
- **Accessibility**: Pass WCAG audits
- **Performance**: Lighthouse scores 90+

---

**Last Updated**: February 6, 2026  
**Status**: Analysis Complete - Ready for Phase 2 (Architecture Design)
