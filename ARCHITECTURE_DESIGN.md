# PowerMySport - Architecture & Design System

## 🏗️ New Frontend Architecture

### File Structure

```
client/src/
├── app/                          # Next.js app directory (PRESERVE EXISTING ROUTES)
│   ├── (auth)/                   # Auth pages (login, register, etc.)
│   ├── (marketing)/              # Public marketing pages → REFACTOR
│   │   ├── page.tsx              # Home
│   │   ├── about/                # NEW
│   │   ├── services/             # NEW
│   │   ├── how-it-works/         # NEW
│   │   ├── contact/              # NEW
│   │   └── layout.tsx            # Shared marketing layout
│   ├── admin/                    # Admin dashboard (preserve)
│   ├── coach/                    # Coach dashboard (preserve)
│   ├── dashboard/                # Player dashboard (preserve)
│   ├── venue-lister/             # Venue lister dashboard (preserve)
│   └── venue-inquiry/            # Inquiry form (preserve)
├── components/                   # NEW: Reusable component library
│   ├── ui/                       # Base UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Badge.tsx
│   │   ├── Modal.tsx
│   │   └── ...
│   ├── layout/                   # Layout components
│   │   ├── Navigation.tsx        # Global nav bar
│   │   ├── Footer.tsx            # Global footer
│   │   ├── Container.tsx         # Content container
│   │   └── Section.tsx           # Page sections
│   ├── marketing/                # Marketing-specific components
│   │   ├── Hero.tsx
│   │   ├── Features.tsx
│   │   ├── Testimonials.tsx
│   │   ├── Stats.tsx
│   │   ├── CTA.tsx
│   │   └── Pricing.tsx
│   └── booking/                  # PRESERVE EXISTING
├── lib/                          # API clients (PRESERVE ALL)
├── store/                        # Zustand stores (PRESERVE ALL)
├── types/                        # TypeScript types (PRESERVE)
└── utils/                        # Utility functions
    ├── cn.ts                     # PRESERVE
    ├── format.ts                 # PRESERVE
    └── constants.ts              # NEW: Design tokens
```

---

## 🎨 Design System

### Color Palette (from Tailwind config)

```typescript
const colors = {
  // Primary Brand Colors
  powerOrange: "#FF6B35", // Main CTA, highlights
  deepSlate: "#1E293B", // Headings, important text
  turfGreen: "#10B981", // Success states, venue indicators

  // Neutral Colors
  ghostWhite: "#F8FAFC", // Backgrounds, cards
  muted: "#64748B", // Secondary text
  border: "#E2E8F0", // Borders, dividers

  // Semantic Colors
  errorRed: "#EF4444", // Errors, destructive actions
  warning: "#F59E0B", // Warnings, pending states
  info: "#3B82F6", // Information, links
};
```

### Typography Scale

```typescript
const typography = {
  // Headings
  h1: "text-5xl font-bold", // 48px
  h2: "text-4xl font-bold", // 36px
  h3: "text-3xl font-bold", // 30px
  h4: "text-2xl font-semibold", // 24px
  h5: "text-xl font-semibold", // 20px
  h6: "text-lg font-semibold", // 18px

  // Body
  bodyLarge: "text-lg", // 18px
  body: "text-base", // 16px
  bodySmall: "text-sm", // 14px
  caption: "text-xs", // 12px

  // Special
  button: "text-base font-semibold",
  link: "text-base text-power-orange hover:underline",
};
```

### Spacing Scale

```typescript
const spacing = {
  xs: "0.5rem", // 8px
  sm: "1rem", // 16px
  md: "1.5rem", // 24px
  lg: "2rem", // 32px
  xl: "3rem", // 48px
  "2xl": "4rem", // 64px
  "3xl": "6rem", // 96px
};
```

### Component Patterns

#### Button Variants

```typescript
const buttonVariants = {
  primary: "bg-power-orange text-white hover:bg-orange-600",
  secondary: "bg-deep-slate text-white hover:bg-slate-700",
  outline:
    "border-2 border-power-orange text-power-orange hover:bg-power-orange hover:text-white",
  ghost: "text-power-orange hover:bg-orange-50",
  success: "bg-turf-green text-white hover:bg-green-600",
  danger: "bg-error-red text-white hover:bg-red-600",
};

const buttonSizes = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-6 py-2.5 text-base",
  lg: "px-8 py-3 text-lg",
};
```

#### Card Variants

```typescript
const cardVariants = {
  default: "bg-card border border-border rounded-lg p-6",
  elevated: "bg-card border border-border rounded-lg p-6 shadow-lg",
  interactive:
    "bg-card border border-border rounded-lg p-6 hover:shadow-xl transition-shadow cursor-pointer",
};
```

---

## 📐 Layout System

### Container Widths

```typescript
const containers = {
  sm: "max-w-2xl", // 672px - narrow content
  md: "max-w-4xl", // 896px - articles, forms
  lg: "max-w-6xl", // 1152px - standard pages
  xl: "max-w-7xl", // 1280px - wide layouts
  full: "max-w-full", // 100% - edge-to-edge
};
```

### Grid System

```typescript
// Feature grids
const featureGrid = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6";

// Auto-fit responsive grid
const responsiveGrid =
  "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6";
```

---

## 🧩 Component Library Specifications

### 1. Navigation Component

**Purpose**: Global navigation bar for marketing pages  
**Features**:

- Logo on left
- Navigation links in center
- Auth buttons on right (Login/Register)
- Mobile-responsive hamburger menu
- Sticky on scroll

**Props**:

```typescript
interface NavProps {
  variant?: "light" | "dark";
  sticky?: boolean;
}
```

---

### 2. Footer Component

**Purpose**: Global footer for all pages  
**Sections**:

- Company info and logo
- Quick links (Home, About, Services, Contact)
- User role links (Book, List Venue, Become Coach)
- Social media icons
- Copyright notice

---

### 3. Hero Component

**Purpose**: Eye-catching page headers  
**Variants**:

- `home`: Full-screen with background, CTA buttons
- `page`: Smaller header for internal pages
- `split`: Image on one side, content on other

**Props**:

```typescript
interface HeroProps {
  variant: "home" | "page" | "split";
  title: string;
  subtitle?: string;
  backgroundImage?: string;
  actions?: Array<{ label: string; href: string; variant: ButtonVariant }>;
}
```

---

### 4. Features Component

**Purpose**: Showcase platform benefits  
**Layout**: Responsive grid of feature cards  
**Props**:

```typescript
interface Feature {
  icon: string | ReactNode;
  title: string;
  description: string;
}

interface FeaturesProps {
  features: Feature[];
  columns?: 2 | 3 | 4;
  variant?: "card" | "minimal";
}
```

---

### 5. Button Component

**Purpose**: Unified button styling  
**Props**:

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "secondary"
    | "outline"
    | "ghost"
    | "success"
    | "danger";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  loading?: boolean;
  icon?: ReactNode;
}
```

---

### 6. Card Component

**Purpose**: Content containers  
**Props**:

```typescript
interface CardProps {
  variant?: "default" | "elevated" | "interactive";
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}
```

---

### 7. Stats Component

**Purpose**: Display metrics and achievements  
**Props**:

```typescript
interface Stat {
  value: string | number;
  label: string;
  icon?: ReactNode;
  trend?: { direction: "up" | "down"; value: string };
}

interface StatsProps {
  stats: Stat[];
  variant?: "horizontal" | "grid";
}
```

---

### 8. Testimonial Component

**Purpose**: Social proof from users  
**Props**:

```typescript
interface Testimonial {
  quote: string;
  author: string;
  role: string;
  avatar?: string;
  rating?: number;
}

interface TestimonialsProps {
  testimonials: Testimonial[];
  variant?: "carousel" | "grid";
}
```

---

### 9. CTA (Call-to-Action) Component

**Purpose**: Drive user conversions  
**Props**:

```typescript
interface CTAProps {
  title: string;
  description?: string;
  actions: Array<{ label: string; href: string; variant: ButtonVariant }>;
  variant?: "banner" | "box" | "full";
  backgroundImage?: string;
}
```

---

## 📱 Responsive Breakpoints

```typescript
const breakpoints = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
};
```

**Mobile-First Approach**: All components start mobile, scale up

---

## ♿ Accessibility Guidelines

### Requirements for All Components:

- ✅ Semantic HTML elements
- ✅ ARIA labels where needed
- ✅ Keyboard navigation support
- ✅ Focus indicators visible
- ✅ Color contrast ratio ≥ 4.5:1 (WCAG AA)
- ✅ Screen reader tested
- ✅ Skip navigation links
- ✅ Alt text for all images

---

## 🔄 State Management

### Existing Stores (PRESERVE):

- `authStore` - User authentication
- `venueStore` - Venue data
- `bookingStore` - Booking flow

### No new global state needed for marketing pages (use React state)

---

## 🚀 Performance Optimizations

### Image Optimization:

- Use Next.js `<Image>` component
- WebP format with fallbacks
- Lazy loading for below-fold images
- Responsive srcset

### Code Splitting:

- Dynamic imports for heavy components
- Route-based code splitting (Next.js automatic)
- Lazy load modals and dropdowns

### Bundle Size:

- Tree-shakeable component exports
- Remove unused Tailwind classes (purge)
- Minimize external dependencies

---

## 📋 Component Development Checklist

For each new component:

- [ ] TypeScript interfaces defined
- [ ] Responsive at all breakpoints
- [ ] Accessible (WCAG AA)
- [ ] Documented with JSDoc comments
- [ ] Reusable and composable
- [ ] Consistent with design system
- [ ] Minimal external dependencies

---

**Last Updated**: February 6, 2026  
**Status**: Ready for Implementation (Phase 3)
