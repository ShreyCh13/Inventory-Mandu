# Inventory Mandu

A robust, production-ready inventory management system built with React, TypeScript, and Supabase. Designed for construction sites and warehouse management with multi-user support, offline capabilities, and real-time synchronization.

![Version](https://img.shields.io/badge/version-4.0.0-blue)
![React](https://img.shields.io/badge/React-18.3-61DAFB)
![Supabase](https://img.shields.io/badge/Supabase-Realtime-3ECF8E)
![PWA](https://img.shields.io/badge/PWA-Enabled-5A0FC8)

## Features

### Core Features
- **Real-Time Sync**: Changes appear instantly across all devices with throttled updates
- **Multi-User**: Role-based access (Admin/User) with 15-20+ concurrent user support
- **Category Management**: Organize items into folders
- **Transaction Tracking**: IN/OUT/WIP with full history and pagination
- **Location Tracking**: Track where materials are used
- **Cost Tracking**: Optional amount and bill number fields
- **Contractor Management**: Track materials given to contractors with balance sheets
- **Mobile-First PWA**: Installable app that works offline

### Reliability Features (v4.0)
- **High-Performance Stock Lookups**: O(1) queries via trigger-maintained `stock_summary` table
- **Connection Quality Monitoring**: Visual indicators for network health
- **Automatic Retry**: Exponential backoff for failed requests
- **Offline Stock Validation**: Prevents negative stock even offline
- **Conflict Resolution UI**: Resolve sync conflicts with a dialog
- **Error Boundary**: Graceful error handling with recovery options
- **Session Expiry Warning**: Notification before 30-day session expires
- **Filter Persistence**: History filters saved across sessions
- **Searchable Dropdowns**: Search items in transaction form
- **Chunked CSV Export**: Handle large exports without memory issues

## Quick Start

### Prerequisites
- Node.js 18+
- Supabase account (free tier works)
- Vercel/Netlify account (for deployment)

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd Inventory-Mandu
npm install
```

### 2. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the database to be ready (~2 minutes)
3. Go to **SQL Editor** → **New Query**
4. Copy the contents of `supabase/schema.sql` and run it
5. Go to **Settings** → **API** and copy:
   - Project URL
   - `anon` public key

### 3. Configure Environment

Create `.env.local` in the project root:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**Default Login:**
- Admin: `admin` / `admin123`
- User: `mandu` / `mandu123`

## Database Migration (Existing Users)

If you're upgrading from v3.x, run the migration SQL:

1. Go to Supabase **SQL Editor**
2. Copy contents of `supabase/MIGRATION_v4.sql`
3. Run the query
4. Verify with: `SELECT * FROM stock_summary LIMIT 10;`

This creates the `stock_summary` table with triggers for instant stock lookups.

## Deploy to Vercel

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com) → Import Project
3. Select your repository
4. Add Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy!

## Install on Mobile (PWA)

### iPhone (Safari only)
1. Open your app URL in Safari
2. Tap Share button (square with arrow)
3. Tap "Add to Home Screen"
4. Tap "Add"

### Android (Chrome)
1. Open your app URL in Chrome
2. Tap the install banner, or Menu → "Install app"
3. Tap "Install"

## Project Structure

```
Inventory-Mandu/
├── App.tsx                    # Main app with state management
├── types.ts                   # TypeScript types
├── index.tsx                  # Entry point with providers
├── lib/
│   ├── supabase.ts            # Supabase client & connection monitoring
│   ├── database.types.ts      # Database types & converters
│   └── db.ts                  # Database operations with caching
├── components/
│   ├── Dashboard.tsx          # Main inventory view
│   ├── TransactionForm.tsx    # Stock IN/OUT/WIP form
│   ├── ItemManager.tsx        # Catalog view
│   ├── HistoryLog.tsx         # Transaction history with filters
│   ├── LoginPage.tsx          # Authentication
│   ├── AdminPanel.tsx         # Admin settings
│   ├── SearchableSelect.tsx   # Searchable dropdown component
│   ├── SyncConflictDialog.tsx # Conflict resolution UI
│   ├── ErrorBoundary.tsx      # Error handling wrapper
│   └── ...
├── public/
│   ├── sw.js                  # Service worker with API caching
│   └── manifest.json          # PWA manifest
├── supabase/
│   ├── schema.sql             # Full database schema
│   └── MIGRATION_v4.sql       # Upgrade migration
└── package.json
```

## Architecture

### Stock Calculation (v4.0)

Stock levels are now calculated via trigger-maintained `stock_summary` table:

```sql
-- O(1) lookup instead of O(n) aggregation
SELECT current_quantity, wip_quantity FROM stock_summary WHERE item_id = ?
```

Triggers automatically update stock on every INSERT/UPDATE/DELETE on transactions.

### Real-Time Sync

```
User Action → Supabase → Throttled Subscription (2-3s) → Incremental Updates → UI
```

- Items/Transactions: 2 second throttle with incremental merging
- Categories/Contractors: 3 second throttle

### Offline Support

```
Online:  App → Supabase API (with retry) → Cache
Offline: App → localStorage + Pending Queue → Sync when online
```

- Service worker caches API responses for 5 minutes
- Pending operations queue syncs when connection restored
- Offline stock validation prevents negative stock

## User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Manage users, edit all transactions, manage categories/contractors |
| **User** | Add/use stock, view all data, edit own transactions |

## Performance

| Metric | Capacity |
|--------|----------|
| Items | 10,000+ |
| Transactions | 100,000+ per year |
| Concurrent Users | 15-20+ on slow WiFi |
| Stock Lookup | O(1) via triggers |
| Pagination | 50 items per page |

## Connection Quality

| Quality | Latency | Indicator |
|---------|---------|-----------|
| Excellent | <300ms | Green |
| Good | <800ms | Green |
| Slow | <2000ms | Amber |
| Poor | >2000ms | Red |
| Offline | N/A | Red + "Offline Mode" |

## Troubleshooting

### "Stock error when removing items"
- Another user may have taken stock. The app shows actual available quantity.

### "Sync conflicts detected"
- Click the conflict indicator to resolve. Choose to retry or dismiss each conflict.

### "Session expiring warning"
- Click "Renew" to extend your session for another 30 days.

### "Real-time not working"
- Verify Supabase URL is correct
- Check that tables have realtime enabled (run schema.sql)

### "Data not syncing"
- Check if Supabase project is paused (free tier pauses after 1 week inactivity)
- Check for pending operations in the status bar

## Development

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Type check
```

## License

MIT License

---

**v4.0.0** - Production-ready with high-performance stock tracking and enhanced reliability.
