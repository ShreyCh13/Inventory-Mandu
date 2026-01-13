# 📦 Inventory Mandu

A real-time inventory management system built with React, TypeScript, and Supabase. Designed for construction sites and warehouse management with multi-user support and live synchronization.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![React](https://img.shields.io/badge/React-18.3-61DAFB)
![Supabase](https://img.shields.io/badge/Supabase-Realtime-3ECF8E)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000)

## ✨ Features

- **🔄 Real-Time Sync**: Changes appear instantly across all devices
- **👥 Multi-User**: Role-based access (Admin/User)
- **📁 Category Management**: Organize items into folders
- **📊 Transaction Tracking**: IN/OUT/WIP with full history
- **📍 Location Tracking**: Track where materials are used
- **💰 Cost Tracking**: Optional amount and bill number fields
- **📱 Mobile-First**: Responsive design works on all devices
- **☁️ Cloud Storage**: Data persists in Supabase PostgreSQL
- **📤 Google Sheets Export**: Optional sync to Google Sheets

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account (free tier works)
- Vercel account (for deployment)

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

## 🌐 Deploy to Vercel

### Option A: One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/inventory-mandu)

### Option B: Manual Deploy

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com) → Import Project
3. Select your repository
4. Add Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy!

## 📊 Supabase Dashboard

After setup, you can view your data directly in Supabase:

1. Go to your Supabase project
2. Click **Table Editor** in the sidebar
3. Browse tables: `users`, `categories`, `items`, `transactions`

### Useful Views

The schema creates helpful views:

- **`current_stock`**: Shows current quantity for each item
- **`daily_summary`**: Aggregated daily transaction stats

Query them in SQL Editor:
```sql
SELECT * FROM current_stock WHERE current_quantity < min_stock;
```

## 🔧 Configuration

### Real-Time Settings

Real-time sync is enabled by default. The app subscribes to:
- `items` - New/updated inventory items
- `transactions` - Stock movements
- `categories` - Folder changes

### Google Sheets Integration (Optional)

1. Create a Google Sheet
2. Go to **Extensions** → **Apps Script**
3. Paste this code:

```javascript
function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheets()[0];
  var data = JSON.parse(e.postData.contents);
  sheet.appendRow([
    data.date, 
    data.item, 
    data.folder, 
    data.type, 
    data.qty, 
    data.unit, 
    data.user, 
    data.reason,
    data.location,
    data.amount,
    data.billNumber
  ]);
  return ContentService.createTextOutput("OK");
}
```

4. **Deploy** → **New Deployment** → **Web App**
5. Set access to "Anyone"
6. Copy the URL and paste in app Settings

## 📁 Project Structure

```
Inventory-Mandu/
├── App.tsx                 # Main app component
├── types.ts                # TypeScript type exports
├── index.tsx               # React entry point
├── lib/
│   ├── supabase.ts         # Supabase client & helpers
│   ├── database.types.ts   # Database types & converters
│   └── db.ts               # Database operations layer
├── components/
│   ├── Dashboard.tsx       # Main inventory view
│   ├── TransactionForm.tsx # Stock IN/OUT/WIP form
│   ├── ItemManager.tsx     # Catalog view
│   ├── HistoryLog.tsx      # Transaction history
│   ├── LoginPage.tsx       # Authentication
│   ├── UserManager.tsx     # Admin: manage users
│   ├── CategoryManager.tsx # Admin: manage categories
│   ├── SyncSettings.tsx    # Google Sheets config
│   └── Icons.tsx           # SVG icon components
├── supabase/
│   └── schema.sql          # Database schema
├── vercel.json             # Vercel config with caching
└── package.json
```

## 🔐 User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Manage users, edit all transactions, manage categories, full access |
| **User** | Add/use stock, edit own transactions, view all data |

## ⚡ Performance

The app is optimized for long-term use:

- **Pagination**: History loads 50 items at a time
- **Indexed Queries**: Database indexes on common query patterns
- **Edge Caching**: Static assets cached for 1 year on Vercel
- **Real-Time Efficiency**: Rate-limited to 10 events/second
- **Lazy Loading**: Components load on demand

### Expected Capacity

| Metric | Capacity |
|--------|----------|
| Items | 10,000+ |
| Transactions | 100,000+ per year |
| Concurrent Users | 50+ |
| Response Time | <100ms (cached) |

## 🛠️ Development

### Commands

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Type check
```

### Local vs Cloud Mode

The app works in two modes:

1. **Cloud Mode** (Supabase configured): Real-time sync, multi-device
2. **Local Mode** (no Supabase): Uses localStorage, single device

The mode is detected automatically based on environment variables.

## 📱 Mobile Support

The app is fully responsive:
- Bottom navigation on mobile
- Side navigation on desktop
- Touch-optimized buttons
- Pull-to-refresh (native feel)

## 🔄 Backup & Recovery

### Automatic Backups
Supabase provides automatic daily backups (7-day retention on free tier).

### Manual Export
1. Go to History tab
2. Click the download icon
3. CSV file downloads with all transactions

### Database Export
In Supabase Dashboard:
1. Go to **Settings** → **Database**
2. Click **Download backup**

## 🆘 Troubleshooting

### "Real-time not working"
- Check Supabase connection in browser console
- Verify `VITE_SUPABASE_URL` is correct
- Ensure tables have realtime enabled (run schema.sql again)

### "Data not syncing"
- Check if Supabase project is paused (free tier pauses after 1 week of inactivity)
- Verify API keys in environment variables

### "Slow performance"
- Clear browser cache
- Check Supabase dashboard for database size
- Consider archiving old transactions

## 📄 License

MIT License - feel free to use for your projects.

---

Built with ❤️ for efficient inventory management.
