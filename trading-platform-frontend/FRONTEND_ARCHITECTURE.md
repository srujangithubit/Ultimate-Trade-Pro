# TradePro — Frontend Architecture Reference

> **Purpose**: This document is the single source of truth for the TradePro frontend codebase. It enables any AI or developer to understand **every layer** of the frontend — from routing and layouts to the smallest UI primitive — and make UI changes / upgrades (e.g. 3D animations) **without altering the project structure, file organization, or codespace conventions**.

---

## Table of Contents

1. [Tech Stack & Dependencies](#1-tech-stack--dependencies)
2. [Project Root Structure](#2-project-root-structure)
3. [Routing & Pages](#3-routing--pages)
4. [Provider & Layout Hierarchy](#4-provider--layout-hierarchy)
5. [Component Architecture](#5-component-architecture)
6. [State Management](#6-state-management)
7. [API Layer & Data Fetching](#7-api-layer--data-fetching)
8. [Real-Time / WebSocket Layer](#8-real-time--websocket-layer)
9. [Design System & Theming](#9-design-system--theming)
10. [Animation System](#10-animation-system)
11. [Type System](#11-type-system)
12. [Utility Modules](#12-utility-modules)
13. [File Naming & Code Conventions](#13-file-naming--code-conventions)
14. [Page-by-Page Component Map](#14-page-by-page-component-map)
15. [Component Catalog (Full List)](#15-component-catalog-full-list)

---

## 1. Tech Stack & Dependencies

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Framework** | Next.js (App Router) | 16.1.6 | SSR, file-based routing, React Server Components |
| **Language** | TypeScript | ^5 | Static typing (strict mode) |
| **UI Runtime** | React | 19.2.3 | Component rendering |
| **Styling** | Tailwind CSS v4 | ^4 | Utility-first CSS |
| **CSS Animations** | tw-animate-css | ^1.4.0 | Tailwind animation utilities |
| **Component Library** | Radix UI (via shadcn) | ^1.4.3 | Accessible headless primitives |
| **Motion** | Framer Motion | ^12.34.3 | Page transitions, stagger animations, micro-interactions |
| **Charts (Financial)** | lightweight-charts | ^5.1.0 | Candlestick / OHLCV charts |
| **Charts (Analytics)** | Recharts | ^3.7.0 | Bar charts, line charts, pie charts |
| **State Management** | Zustand (+ Immer middleware) | ^5.0.11 | Global client state |
| **Server State** | TanStack React Query | ^5.90.21 | Async cache, pagination, refetch |
| **HTTP Client** | Axios | ^1.13.5 | REST API communication |
| **WebSockets** | socket.io-client | ^4.8.3 | Real-time data (ticks, trades, sync) |
| **Forms** | React Hook Form + Zod | ^7.71.1 / ^4.3.6 | Validation & form state |
| **Icons** | lucide-react | ^0.564.0 | SVG icon library |
| **Theming** | next-themes | ^0.4.6 | Dark / Light mode toggle |
| **Toast** | Sonner | ^2.0.7 | Notification toasts |
| **Date Utilities** | date-fns | ^4.1.0 | Date formatting & parsing |
| **Screenshot** | html-to-image | ^1.11.13 | Export UI cards as images |
| **Testing** | Playwright | ^1.58.2 | E2E browser tests |

### Build & Dev Commands

```bash
npm run dev      # Starts dev server on port 3002
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
```

---

## 2. Project Root Structure

```
trading-platform-frontend/
├── app/                      # Next.js App Router — pages & layouts
│   ├── (auth)/               # Auth route group (login, register, forgot-password)
│   ├── (dashboard)/          # Dashboard route group (all protected pages)
│   ├── api/                  # API routes (server-side, e.g. news proxy)
│   ├── globals.css           # Global styles, design tokens, custom CSS
│   ├── layout.tsx            # Root layout (HTML shell, providers)
│   ├── page.tsx              # Landing / root redirect
│   └── providers.tsx         # React Query provider
│
├── components/               # Reusable UI components (feature-organized)
│   ├── analytics/            # Analytics page components (14 files)
│   ├── auth/                 # Auth provider (1 file)
│   ├── backtesting/          # Backtesting toolbar & drawing (8 files)
│   ├── charts/               # Chart panels and controls (15 files)
│   ├── community/            # Social / community feed (9 files)
│   ├── features/             # Feature-specific composites
│   │   └── backtesting/      # Backtesting feature components (3 files)
│   ├── layouts/              # DashboardLayout, CommandPalette (2 files)
│   ├── mt5/                  # MT5 connection, dashboard, analytics (9 files)
│   ├── overview/             # Overview widgets (1 file)
│   ├── shared/               # Cross-feature shared components (1 file)
│   ├── trade-sync/           # Trade copier / sync components (13 files)
│   └── ui/                   # shadcn/Radix primitives (23 files)
│
├── hooks/                    # Top-level custom hooks (2 files)
│
├── lib/                      # Core business logic
│   ├── api/                  # API client modules (8 files)
│   ├── drawing/              # Chart drawing tools & renderers (4 files)
│   ├── hooks/                # Business-logic hooks (16 files)
│   ├── replay/               # Replay engine + web worker (2 files)
│   ├── stores/               # Zustand stores (5 files)
│   ├── types/                # TypeScript interfaces (4 files)
│   └── utils/                # Utility functions (7 files)
│
├── stores/                   # Additional Zustand stores (1 file)
├── types/                    # Top-level TypeScript types (1 file)
├── public/                   # Static assets
├── tests/                    # Playwright E2E tests
│
├── next.config.ts            # Next.js configuration
├── tsconfig.json             # TypeScript configuration (strict, @/* alias)
├── package.json              # Dependencies
├── postcss.config.mjs        # PostCSS (Tailwind)
├── eslint.config.mjs         # ESLint
└── components.json           # shadcn component config
```

### Path Alias

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": { "@/*": ["./*"] }
  }
}
```

All imports use `@/` prefix. Example: `import { Button } from '@/components/ui/button'`.

---

## 3. Routing & Pages

Next.js App Router uses **route groups** to separate auth and dashboard experiences.

### Route Groups

| Group | Path Pattern | Description |
|---|---|---|
| `(auth)` | `/login`, `/register`, `/forgot-password` | Public-only routes (redirect to `/overview` if authenticated) |
| `(dashboard)` | `/overview`, `/charts`, `/accounts`, etc. | Protected routes (redirect to `/login` if unauthenticated) |

### Complete Page Registry

| Route | Page File | Key Components Used |
|---|---|---|
| `/` | `app/page.tsx` | Root redirect |
| `/login` | `app/(auth)/login/page.tsx` | Auth form |
| `/register` | `app/(auth)/register/page.tsx` | Registration form |
| `/forgot-password` | `app/(auth)/forgot-password/page.tsx` | Password reset |
| `/overview` | `app/(dashboard)/overview/page.tsx` | `ForexSessionIndicator`, stats cards, live positions, recent trades table |
| `/charts` | `app/(dashboard)/charts/page.tsx` | `TradingViewChart`, `CandleChart`, `TopBar`, `BottomPanel`, `RightPanel`, `OrderPanel` |
| `/accounts` | `app/(dashboard)/accounts/page.tsx` | `MT5Dashboard`, `MT5ConnectDialog`, `MT5Analytics` |
| `/backtesting` | `app/(dashboard)/backtesting/page.tsx` | Session list, create backtest |
| `/backtesting/[sessionId]` | `app/(dashboard)/backtesting/[sessionId]/page.tsx` | `DrawingLayer`, `DrawingToolbar`, `PlaybackControls`, `SetupDetector` |
| `/backtesting/[sessionId]/report` | `app/(dashboard)/backtesting/[sessionId]/report/page.tsx` | Backtest report |
| `/journal` | `app/(dashboard)/journal/page.tsx` | Trade journal CRUD |
| `/analytics` | `app/(dashboard)/analytics/page.tsx` | All 14 analytics components |
| `/playbooks` | `app/(dashboard)/playbooks/page.tsx` | Strategy playbooks |
| `/checklist` | `app/(dashboard)/checklist/page.tsx` | Pre-trade checklist |
| `/calculators` | `app/(dashboard)/calculators/page.tsx` | Position size, pip, risk/reward calculators |
| `/news` | `app/(dashboard)/news/page.tsx` | Financial news feed |
| `/community` | `app/(dashboard)/community/page.tsx` | `PostFeed`, `LeftSidebar`, `RightSidebar`, `LiveChat` |
| `/community/[postId]` | `app/(dashboard)/community/[postId]/page.tsx` | `PostDetail`, `Comments` |
| `/trade-sync` | `app/(dashboard)/trade-sync/page.tsx` | `TradeSyncDashboard`, `TradeSyncSetup`, all trade-sync components |
| `/settings` | `app/(dashboard)/settings/page.tsx` | User settings, profile |

---

## 4. Provider & Layout Hierarchy

The component tree wraps children in this order (outermost → innermost):

```
<html>
  <body>
    Providers (React Query — QueryClientProvider)
      ThemeProvider (next-themes, default: "dark")
        AuthProvider (auth gate — redirects unauthenticated)
          TooltipProvider (Radix)
            {children}
            Toaster (Sonner — top-right)
```

### Auth Layout (`(auth)/layout.tsx`)

- **Split-screen**: Left panel = branding/stats (hidden on mobile), Right panel = form content.
- Left panel has blur decorations, TradePro logo, stats (10K+ traders, 2M+ trades, 98% satisfaction).
- Not wrapped in `DashboardLayout`.

### Dashboard Layout (`(dashboard)/layout.tsx`)

```
MT5Provider (React Context)
  DashboardLayout
    ├── Desktop Sidebar (collapsed 68px → expands 256px on hover)
    │   ├── TradePro logo
    │   ├── 13 navigation items (with icons from lucide-react)
    │   ├── Theme toggle
    │   └── User avatar + logout
    ├── Top Header Bar
    │   ├── Mobile hamburger menu (Sheet)
    │   ├── Search bar → opens CommandPalette (Ctrl+K)
    │   ├── Notifications dropdown
    │   └── Profile dropdown menu
    └── Main content area
        └── PageTransition (Framer Motion wrapper)
            └── {page content}
```

### Dashboard Template (`(dashboard)/template.tsx`)

Every dashboard page is wrapped in `PageTransition` — a Framer Motion `<motion.main>` with spring-based enter/exit animations.

### Key Layout Components

| Component | File | Purpose |
|---|---|---|
| `DashboardLayout` | `components/layouts/DashboardLayout.tsx` | Sidebar + header + main area (377 lines) |
| `CommandPalette` | `components/layouts/CommandPalette.tsx` | Global search dialog (Ctrl+K) |
| `PageTransition` | `components/ui/page-transition.tsx` | Framer Motion page animation wrapper |
| `AuthProvider` | `components/auth/AuthProvider.tsx` | Client-side auth gate, redirect logic |

---

## 5. Component Architecture

### Organizational Principle

Components follow a **feature-first** organization:

```
components/
├── {feature}/              # Feature-specific (analytics, charts, mt5, etc.)
│   └── ComponentName.tsx   # PascalCase, one component per file
├── shared/                 # Cross-feature reusable components
├── layouts/                # Layout shells
└── ui/                     # Primitive UI components (shadcn/Radix)
```

### Component Patterns Used

1. **Client Components**: All interactive components use `'use client'` directive.
2. **Server Components**: Layout files (without state/effects) are Server Components.
3. **shadcn Pattern**: UI primitives in `components/ui/` follow shadcn conventions — thin wrappers around Radix primitives with Tailwind + CVA (class-variance-authority) for variants.
4. **Framer Motion**: Components use `<motion.div>` for entry animations, stagger groups, and hover micro-interactions.
5. **Composition**: Pages compose feature components; feature components compose UI primitives.

---

## 6. State Management

### Zustand Stores

| Store | File | Slices / State | Purpose |
|---|---|---|---|
| `useAuthStore` | `lib/stores/authStore.ts` | `user`, `token`, `isAuthenticated`, `isLoading`, `error` + `login()`, `register()`, `logout()`, `initialize()` | Authentication state |
| `useTradingStore` | `lib/stores/tradingStore.ts` | **8 slices**: Symbol, Replay, Position, Order, Risk, Account, Crosshair, Strategy. Uses Immer middleware. | Chart trading state |
| `useBacktestingStore` | `lib/stores/backtestingStore.ts` | `sessionId`, `isPlaying`, `playbackSpeed`, `balance`, `positions` | Backtesting session state |
| `useCommunityStore` | `lib/stores/communityStore.ts` | Community feed state | Social feature state |
| `useUserPreferencesStore` | `lib/stores/userPreferencesStore.ts` | `avatarUrl` and user prefs | User preferences |
| `useTradeSyncStore` | `stores/tradeSyncStore.ts` | Trade copier sync groups, real-time data | Trade sync feature |

### Server State (React Query)

All API data fetching uses `useQuery` / `useMutation` from TanStack React Query. Query keys follow a descriptive convention:

```typescript
const { data } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: async () => { const { data } = await api.get('/analytics/overview'); return data; }
});
```

### Context Providers

| Context | File | Purpose |
|---|---|---|
| `MT5Context` / `MT5Provider` | `components/mt5/MT5Context.tsx` | MT5 connection, positions, ticks, orders. Uses `useMT5WebSocket` hook internally. |

---

## 7. API Layer & Data Fetching

### API Client (`lib/api/client.ts`)

- Base URL: `NEXT_PUBLIC_API_URL` (default: `http://localhost:3000`)
- Axios instance with interceptors:
  - **Request**: Attaches `Bearer` token from `localStorage('auth_token')`
  - **Response**: Auto-refreshes expired tokens via `/auth/refresh`, redirects to `/login` on failure

### API Modules

| Module | File | Endpoints |
|---|---|---|
| `client.ts` | `lib/api/client.ts` | Base axios instance |
| `accounts.ts` | `lib/api/accounts.ts` | Account management |
| `trades.ts` | `lib/api/trades.ts` | Trade CRUD |
| `playbooks.ts` | `lib/api/playbooks.ts` | Strategy playbooks |
| `mt5.ts` | `lib/api/mt5.ts` | MT5 connect, orders, positions |
| `chart-validation.ts` | `lib/api/chart-validation.ts` | Chart data validation |
| `setup-detection.ts` | `lib/api/setup-detection.ts` | Pattern detection |
| `mock-data.ts` | `lib/api/mock-data.ts` | Development mock data |

### Server API Routes

| Route | File | Purpose |
|---|---|---|
| `/api/news` | `app/api/news/route.ts` | News proxy (server-side fetch) |

---

## 8. Real-Time / WebSocket Layer

### Custom Hooks for WebSockets

| Hook | File | Purpose |
|---|---|---|
| `useMT5WebSocket` | `lib/hooks/useMT5WebSocket.ts` | MT5 server connection (positions, ticks, account info) |
| `useBacktestSocket` | `lib/hooks/useBacktestSocket.ts` | Backtesting session WebSocket |
| `useWebSocket` | `lib/hooks/useWebSocket.ts` | Generic WebSocket hook |
| `useMarketStream` | `lib/hooks/useMarketStream.ts` | Live market data streaming |
| `useSyncSocket` | `hooks/useSyncSocket.ts` | Trade sync real-time events |
| `useLiveCandles` | `lib/hooks/useLiveCandles.ts` | Live candlestick data |

### Replay Engine

| File | Purpose |
|---|---|
| `lib/replay/ReplayEngine.ts` | Backtesting replay orchestrator |
| `lib/replay/replayWorker.ts` | Web Worker for background replay processing |

---

## 9. Design System & Theming

### CSS Architecture

- **Tailwind CSS v4** with PostCSS
- **shadcn/ui** component tokens via CSS custom properties
- **OKLCH color space** for all color values (modern, perceptually uniform)
- **Dark mode** via `next-themes` (class-based: `.dark`)

### Design Tokens (`globals.css`)

All colors are defined as CSS custom properties using OKLCH:

```css
:root {
  --primary: oklch(0.55 0.2 260);        /* Purple-blue */
  --background: oklch(0.985 0.002 247);   /* Near-white */
  --success: oklch(0.65 0.2 145);         /* Green */
  --warning: oklch(0.75 0.18 75);         /* Amber */
  --destructive: oklch(0.577 0.245 27.325); /* Red */
  /* ... 30+ tokens for cards, borders, sidebar, charts */
}

.dark {
  --primary: oklch(0.65 0.22 260);
  --background: oklch(0.12 0.01 260);
  /* ... all dark mode overrides */
}
```

### Custom CSS Classes

| Class | Effect |
|---|---|
| `.glass` | Glassmorphism: `backdrop-filter: blur(12px)` with transparent bg |
| `.gradient-text` | Gradient fill for text (primary → purple) |
| `.transition-smooth` | Smooth 200ms cubic-bezier transition |
| `.animate-glow` | Pulsing glow box-shadow animation |
| `.text-profit` / `.text-loss` | Green / Red P&L text colors |
| `.bg-profit` / `.bg-loss` | Green / Red P&L backgrounds (15% opacity) |
| `.card-hover` | Lift card on hover with shadow |
| `.animate-fadeIn` | Fade-in from below |

### Border Radius Scale

```css
--radius: 0.625rem;      /* Base = 10px */
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 10px;
--radius-xl: 14px;
--radius-2xl: 18px;
```

### Fonts

- **Sans**: Geist Sans (Google Fonts, variable `--font-geist-sans`)
- **Mono**: Geist Mono (Google Fonts, variable `--font-geist-mono`)

### Scrollbar

Custom thin scrollbar: 6px width, transparent track, semi-transparent thumb.

---

## 10. Animation System

### Framer Motion Presets (`lib/utils/motion.ts`)

Pre-defined animation objects for consistent motion across the app:

| Preset | Effect |
|---|---|
| `fadeIn` | Opacity 0 → 1 (200ms) |
| `fadeInUp` | Opacity 0→1, Y 20→0 (300ms, easeOut) |
| `fadeInDown` | Opacity 0→1, Y -20→0 (300ms, easeOut) |
| `scaleIn` | Opacity 0→1 (200ms, easeOut) |
| `slideInLeft` | Opacity 0→1, X -30→0 (300ms) |
| `slideInRight` | Opacity 0→1, X 30→0 (300ms) |
| `staggerContainer` | Parent with `staggerChildren: 0.06` |
| `staggerItem` | Child: Opacity 0→1, Y 10→0 |
| `pulse` | Scale [1, 1.05, 1] (300ms) |

### Page Transition (`PageTransition` component)

```typescript
// Spring-based enter/exit per page change
variants = {
    hidden: { opacity: 0, y: 20 },
    enter:  { opacity: 1, y: 0 },
    exit:   { opacity: 0, y: -20 },
};
transition = { type: 'spring', stiffness: 260, damping: 20 };
```

### Common Animation Patterns in Pages

```tsx
// Stagger grid children
<motion.div
    initial="hidden" animate="show"
    variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } }}
>
    <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}>
        <Card />
    </motion.div>
</motion.div>

// Hover lift
<motion.div whileHover={{ y: -4, transition: { duration: 0.2 } }}>
    <Card className="card-hover" />
</motion.div>

// Delayed entry
<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
```

---

## 11. Type System

### Type Definition Files

| File | Contents |
|---|---|
| `lib/types/trading.ts` | `Timeframe`, `ReplaySpeed`, `ReplayRange`, `Position`, `Order`, `RiskMetrics`, `AccountSnapshot`, `SignalMarker`, `TradeArrow` |
| `lib/types/mt5.ts` | `MT5ContextValue`, `MT5Credentials`, MT5 position/account types |
| `lib/types/backtesting.ts` | Backtesting session, candle, and replay types |
| `lib/types/community.ts` | Community posts, comments, user profile types |
| `types/trade-sync.ts` | `SyncGroup`, `SlaveAccount`, `MasterAccount`, `ReplicationEvent`, `RiskConfig`, `EquitySnapshot`, `LivePosition`, DTOs, socket events |

### Inline Types

Some pages define local interfaces (e.g., `Trade` interface in overview page). These are gradually being migrated to shared type files.

---

## 12. Utility Modules

| Module | File | Exports |
|---|---|---|
| **Formatters** | `lib/utils/formatters.ts` | `formatCurrency()`, `formatPercent()`, `formatNumber()`, `formatCompactNumber()`, `formatDate()`, `formatDateTime()`, `formatTimeAgo()`, `formatPnL()`, `getPnLColor()`, `getPnLBgColor()` |
| **Motion** | `lib/utils/motion.ts` | Animation presets (see §10) |
| **Validators** | `lib/utils/validators.ts` | Form validation utilities |
| **Timezones** | `lib/utils/timezones.ts` | Timezone conversion helpers |
| **MT5 Stats Adapter** | `lib/utils/mt5StatsAdapter.ts` | Transform MT5 data for analytics |
| **Export Analytics** | `lib/utils/exportAnalytics.ts` | Export analytics data (e.g., CSV) |
| **Checklist Generator** | `lib/checklist-generator.ts` | Pre-trade checklist generation logic |
| **Drawing Geometry** | `lib/drawing/geometry.ts` | Chart drawing math (lines, fibs) |
| **Drawing Renderers** | `lib/drawing/renderers.ts` | Canvas rendering for chart drawings |
| **Drawing Tools** | `lib/drawing/tools.ts` | Drawing tool definitions |
| **Drawing Types** | `lib/drawing/types.ts` | Drawing tool type definitions |

---

## 13. File Naming & Code Conventions

### Naming

| Item | Convention | Example |
|---|---|---|
| Components | PascalCase `.tsx` | `DashboardLayout.tsx` |
| Hooks | camelCase, `use` prefix `.ts` | `useAuth.ts` |
| Stores | camelCase, `Store` suffix `.ts` | `authStore.ts` |
| Types | camelCase `.ts` | `trading.ts` |
| Utilities | camelCase `.ts` | `formatters.ts` |
| Pages | `page.tsx` (Next.js convention) | `overview/page.tsx` |
| Layouts | `layout.tsx` (Next.js convention) | `(dashboard)/layout.tsx` |

### Code Patterns

- **`'use client'`** on all interactive components (those with hooks, state, effects, or event handlers).
- **Server Components** for layouts that don't need client-side interactivity.
- **No default exports** for non-page/layout components (except UI primitives following shadcn convention).
- **Pages and layouts** use default exports (Next.js requirement).
- **Tailwind classes** inline on JSX elements. No separate CSS modules.
- **CVA (class-variance-authority)** for component variants in `components/ui/`.
- **`cn()` utility** (`clsx` + `tailwind-merge`) for conditional class merging.

---

## 14. Page-by-Page Component Map

### Overview Page (`/overview`)

```
OverviewPage
├── ForexSessionIndicator               (components/overview/)
├── Stats Cards Grid (4 cards)          (motion.div + Card)
│   └── Card → CardContent              (components/ui/card)
├── Quick Stats Row (3 cards)           (motion.div + Card)
├── Live Open Positions                 (MT5 positions grid, conditional)
└── Recent Trades Table                 (Table, TableRow, Badge)
```

### Charts Page (`/charts`)

```
ChartsPage
├── TopBar                              (components/charts/)
├── ChartGrid                           (components/charts/)
│   └── TradingViewChart / CandleChart  (components/charts/)
├── BottomPanel                         (components/charts/)
├── RightPanel                          (components/charts/)
├── OrderPanel                          (components/charts/)
├── ReplayControls                      (components/charts/)
└── PerformancePanel                    (components/charts/)
```

### Analytics Page (`/analytics`)

```
AnalyticsPage
├── AdvancedStatsGrid
├── DetailedStatsGrid
├── DailyCumulativePnLChart
├── GrossDailyPnLChart
├── HourlyAnalytics
├── WeekdayAnalysis
├── MonthlyAnalytics
├── WeeklyAnalytics
├── DurationAnalytics
├── LongShortAnalysis
├── SymbolAnalytics
├── SummaryPairs
├── SummarySession
└── SummaryWeek
```

### Accounts Page (`/accounts`)

```
AccountsPage
├── MT5ConnectDialog                    (components/mt5/)
├── MT5Dashboard                        (components/mt5/)
│   ├── MT5AccountSummary
│   ├── MT5LiveTrades
│   └── MT5TradeHistory
├── MT5Analytics                        (components/mt5/)
├── MT5ShareableTradeCard               (components/mt5/)
└── PriceAlertManager                   (components/mt5/)
```

### Community Page (`/community`)

```
CommunityPage
├── LeftSidebar                         (components/community/)
├── PostFeed                            (components/community/)
│   └── PostCard                        (components/community/)
│       └── ChartMiniPreview
├── RightSidebar                        (components/community/)
└── LiveChat                            (components/community/)
```

### Trade Sync Page (`/trade-sync`)

```
TradeSyncPage
├── TradeSyncOverview                   (components/trade-sync/)
├── TradeSyncSetup                      (components/trade-sync/)
├── TradeSyncDashboard                  (components/trade-sync/)
│   ├── SyncGroupCard
│   ├── SlaveAccountCard
│   ├── SyncStatusBadge
│   ├── AddSlaveModal
│   ├── RiskConfigPanel
│   ├── LivePnLPanel
│   ├── DrawdownGauge
│   ├── KillSwitchButton
│   ├── PerformanceComparison
│   └── ReplicationFeed
```

### Backtesting Session Page (`/backtesting/[sessionId]`)

```
BacktestingSessionPage
├── TradingViewToolbar                  (components/backtesting/)
├── DrawingToolbar                      (components/backtesting/)
├── DrawingLayer                        (components/backtesting/)
├── PlaybackControls                    (components/backtesting/)
├── PriceScaleMenu                      (components/backtesting/)
├── FibSettingsDialog                   (components/backtesting/)
├── SetupDetector                       (components/backtesting/)
├── SetupValidator                      (components/backtesting/)
├── OrderEntryPanel                     (components/features/backtesting/)
├── AccountSummary                      (components/features/backtesting/)
└── PlaybackControls (feature)          (components/features/backtesting/)
```

---

## 15. Component Catalog (Full List)

### `components/ui/` — Primitive Components (shadcn/Radix)

| Component | File | Description |
|---|---|---|
| `SafeResponsiveContainer` | `SafeResponsiveContainer.tsx` | Recharts container with safe dimensions |
| `AlertDialog` | `alert-dialog.tsx` | Confirmation dialog |
| `AnimatedBar` | `animated-bar.tsx` | Animated bar for charts |
| `Avatar` | `avatar.tsx` | User avatar with fallback |
| `Badge` | `badge.tsx` | Status/tag badges |
| `Button` | `button.tsx` | Button with variants (default, outline, ghost, destructive) |
| `Card` | `card.tsx` | Card container (Card, CardHeader, CardTitle, CardContent, CardFooter) |
| `Dialog` | `dialog.tsx` | Modal dialog |
| `DropdownMenu` | `dropdown-menu.tsx` | Dropdown menus |
| `Input` | `input.tsx` | Text input field |
| `Label` | `label.tsx` | Form label |
| `PageTransition` | `page-transition.tsx` | Framer Motion page wrapper |
| `Progress` | `progress.tsx` | Progress bar |
| `ScrollArea` | `scroll-area.tsx` | Custom scrollable container |
| `Select` | `select.tsx` | Select dropdown |
| `Separator` | `separator.tsx` | Visual divider |
| `Sheet` | `sheet.tsx` | Slide-out panel (mobile sidebar) |
| `Slider` | `slider.tsx` | Range slider |
| `Switch` | `switch.tsx` | Toggle switch |
| `Table` | `table.tsx` | Data table (Table, TableHeader, TableBody, TableRow, TableCell) |
| `Tabs` | `tabs.tsx` | Tab navigation |
| `Textarea` | `textarea.tsx` | Multi-line text input |
| `Tooltip` | `tooltip.tsx` | Hover tooltip |

### `components/analytics/` — Analytics Components (14)

`AdvancedStatsGrid`, `DailyCumulativePnLChart`, `DetailedStatsGrid`, `DurationAnalytics`, `GrossDailyPnLChart`, `HourlyAnalytics`, `LongShortAnalysis`, `MonthlyAnalytics`, `SummaryPairs`, `SummarySession`, `SummaryWeek`, `SymbolAnalytics`, `WeekdayAnalysis`, `WeeklyAnalytics`

### `components/backtesting/` — Backtesting Components (8)

`DrawingLayer`, `DrawingToolbar`, `FibSettingsDialog`, `PlaybackControls`, `PriceScaleMenu`, `SetupDetector`, `SetupValidator`, `TradingViewToolbar`

### `components/charts/` — Chart Components (15)

`BottomPanel`, `CalendarHeatmap`, `CandleChart`, `ChartGrid`, `DetailedPerformanceCalendar`, `HourlyPerformanceChart`, `OrderPanel`, `PerformancePanel`, `ReplayControls`, `RightPanel`, `TopBar`, `TradeDistributionChart`, `TradingViewChart`, `TradingViewWidget`

### `components/community/` — Community Components (9)

`ChartMiniPreview`, `Comments`, `CreatePostModal`, `LeftSidebar`, `LiveChat`, `PostCard`, `PostDetail`, `PostFeed`, `RightSidebar`, `index.ts` (barrel export)

### `components/mt5/` — MT5 Components (9)

`MT5AccountSummary`, `MT5Analytics`, `MT5ConnectDialog`, `MT5Context` (Provider), `MT5Dashboard`, `MT5LiveTrades`, `MT5ShareableTradeCard`, `MT5TradeHistory`, `PriceAlertManager`

### `components/trade-sync/` — Trade Sync Components (13)

`AddSlaveModal`, `DrawdownGauge`, `KillSwitchButton`, `LivePnLPanel`, `PerformanceComparison`, `ReplicationFeed`, `RiskConfigPanel`, `SlaveAccountCard`, `SyncGroupCard`, `SyncStatusBadge`, `TradeSyncDashboard`, `TradeSyncOverview`, `TradeSyncSetup`

### `components/features/backtesting/` — Feature Backtesting (3)

`AccountSummary`, `OrderEntryPanel`, `PlaybackControls`

---

## Quick Reference: How to Make UI Changes

### To change colors/theme:
Edit `app/globals.css` — modify the CSS custom properties in `:root` and `.dark`.

### To change animations:
Edit `lib/utils/motion.ts` for global presets, or modify individual `<motion.div>` props in page/component files.

### To add a new page:
1. Create `app/(dashboard)/your-page/page.tsx`
2. Add navigation entry in `components/layouts/DashboardLayout.tsx` (`navigation` array)

### To add a new UI primitive:
Add to `components/ui/` following the shadcn/Radix pattern.

### To add a new feature component:
Add to `components/{feature}/` directory.

### To add a new Zustand store:
Create in `lib/stores/` following the existing pattern (create + typed interface).

### To upgrade to 3D animations:
1. Add Three.js / React Three Fiber to `package.json`
2. Create `components/3d/` directory for 3D scene components
3. Modify existing `<motion.div>` elements to use 3D transforms (`rotateX`, `rotateY`, `perspective`, `translateZ`)
4. Update `lib/utils/motion.ts` with 3D animation presets
5. Add WebGL canvas backgrounds to layout components
6. Enhance `globals.css` with `perspective` and `transform-style: preserve-3d` utility classes

---

*Last updated: 2026-03-13*
