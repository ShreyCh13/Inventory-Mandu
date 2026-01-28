# 📱 How to Install Inventory Mandu on Your Phone

## What's New in v3.0

The app has been enhanced for robustness with 15-20 concurrent users on slow WiFi:

- ✅ **Connection quality monitoring** - Visual indicators (green/amber/red)
- ✅ **Automatic retry** - Exponential backoff on network failures
- ✅ **Offline API caching** - Service worker caches Supabase responses
- ✅ **Race condition prevention** - Stock verification before OUT transactions
- ✅ **Throttled real-time updates** - Batched every 2-3 seconds
- ✅ **Debounced search** - 300-400ms delay for better performance
- ✅ **Custom dialogs** - Modern confirmation modals (no browser alerts)
- ✅ **Storage management** - Auto-cleanup when storage is low

---

## 🚀 Step 1: Deploy the App (If Not Already Deployed)

The app needs to be deployed online first. You have two options:

### Option A: Deploy to Vercel (Recommended - Free)

1. **Make sure your code is on GitHub:**
   ```bash
   git add .
   git commit -m "Deploy v3.0 with reliability improvements"
   git push origin main
   ```

2. **Deploy to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Sign up/Login with GitHub
   - Click **"Add New Project"**
   - Import your repository: `ShreyCh13/Inventory-Mandu`
   - Add Environment Variables:
     - `VITE_SUPABASE_URL` = (your Supabase URL)
     - `VITE_SUPABASE_ANON_KEY` = (your Supabase anon key)
   - Click **"Deploy"**
   - Wait 2-3 minutes
   - **Copy the deployment URL** (e.g., `https://inventory-mandu.vercel.app`)

### Option B: Deploy to Netlify (Free Alternative)

1. **Push to GitHub** (same as above)

2. **Deploy to Netlify:**
   - Go to [netlify.com](https://netlify.com)
   - Sign up/Login with GitHub
   - Click **"Add new site"** → **"Import an existing project"**
   - Select your repository
   - Build settings (auto-detected):
     - Build command: `npm run build`
     - Publish directory: `dist`
   - Add Environment Variables:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
   - Click **"Deploy site"**
   - **Copy the deployment URL** (e.g., `https://inventory-mandu.netlify.app`)

### Option C: Test Locally First

If you want to test on your phone before deploying:

1. **Find your computer's IP address:**
   ```bash
   # On Mac/Linux:
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # On Windows:
   ipconfig
   ```
   Look for something like `192.168.1.100`

2. **Start the dev server:**
   ```bash
   npm run dev
   ```

3. **On your phone, open:**
   ```
   http://YOUR_IP_ADDRESS:3000
   ```
   (Replace YOUR_IP_ADDRESS with the IP from step 1)

4. **Make sure your phone and computer are on the same WiFi network**

---

## 📲 Step 2: Install on iPhone (iOS)

1. **Open Safari** (not Chrome - PWA install only works in Safari on iOS)

2. **Go to your app URL:**
   - If deployed: `https://your-app.vercel.app`
   - If local: `http://YOUR_IP:3000`

3. **Tap the Share button** (square with arrow pointing up) at the bottom

4. **Scroll down and tap "Add to Home Screen"**

5. **Edit the name** (optional) and tap **"Add"**

6. **Done!** The app icon will appear on your home screen

7. **Open it like a regular app** - it will work offline and stay logged in!

---

## 🤖 Step 3: Install on Android

1. **Open Chrome** (or Edge/Brave)

2. **Go to your app URL:**
   - If deployed: `https://your-app.vercel.app`
   - If local: `http://YOUR_IP:3000`

3. **Look for the install banner** at the bottom:
   - It will say "Add Inventory Mandu to Home screen"
   - Tap **"Install"** or **"Add"**

   **OR if you don't see the banner:**

4. **Tap the menu** (3 dots) in the top right

5. **Tap "Install app"** or **"Add to Home screen"**

6. **Tap "Install"** in the popup

7. **Done!** The app icon will appear on your home screen

---

## ✅ Step 4: Verify Installation

After installing:

1. **Open the app** from your home screen (not from browser)

2. **Login** with your credentials:
   - Admin: `admin` / `admin123`
   - User: `mandu` / `mandu123`

3. **Check connection quality:**
   - Look at the status indicator at the top
   - 🟢 Green = Excellent/Good
   - 🟡 Amber = Slow (>800ms latency)
   - 🔴 Red = Poor/Offline

4. **Check that you stay logged in:**
   - Close the app completely
   - Reopen it
   - You should still be logged in! ✅

5. **Test offline mode:**
   - Turn off WiFi/data
   - The app should still work (with cached data)
   - When online, pending operations sync automatically

---

## 🔗 Sharing with Your Team (15-20 Devices)

### Method 1: Share the URL

1. **Get your deployment URL** (from Vercel/Netlify)
   - Example: `https://inventory-mandu.vercel.app`

2. **Send this message to your team:**

   ```
   📱 Install Inventory Mandu App:
   
   🌐 Open this link on your phone:
   https://your-app.vercel.app
   
   📲 Then follow these steps:
   
   iPhone:
   1. Open in Safari
   2. Tap Share button (square with arrow)
   3. Tap "Add to Home Screen"
   4. Tap "Add"
   
   Android:
   1. Open in Chrome
   2. Tap menu (3 dots)
   3. Tap "Install app"
   4. Tap "Install"
   
   ✅ Features:
   - Works on slow WiFi (15-20 users supported)
   - Offline access with cached data
   - Auto-retries on network errors
   - 30-day login persistence
   - Shows connection quality indicator
   ```

### Method 2: Create a QR Code

1. **Generate QR code** for your URL:
   - Go to [qr-code-generator.com](https://www.qr-code-generator.com)
   - Enter your app URL
   - Download the QR code

2. **Print and share** - team members scan to install

---

## 🎯 Quick Reference

| Platform | Browser | Install Method |
|----------|---------|----------------|
| **iOS** | Safari only | Share → Add to Home Screen |
| **Android** | Chrome/Edge | Menu → Install app |
| **Desktop** | Any browser | Just bookmark it |

---

## 🌐 Connection Quality Indicators

The app monitors network health in real-time:

| Indicator | Meaning | Latency |
|-----------|---------|---------|
| 🟢 Green | Excellent/Good | <800ms |
| 🟡 Amber | Slow Connection | 800-2000ms |
| 🔴 Red | Poor/Offline | >2000ms or offline |

When connection is slow/poor:
- App uses cached data
- Operations are queued and sync when connection improves
- Real-time updates may be delayed

---

## ❓ Troubleshooting

### "I don't see the install option"
- **iOS:** Make sure you're using Safari, not Chrome
- **Android:** Make sure you're using Chrome or Edge
- Try refreshing the page

### "App doesn't work offline"
- Service worker needs HTTPS (or localhost)
- If testing locally, use `http://localhost:3000` on the same device
- Deployed apps work offline automatically

### "I get logged out"
- Make sure you're not clearing browser data
- Session lasts 30 days - if you don't use it for 30 days, you'll need to login again
- On iOS, closing Safari tabs doesn't log you out

### "Can't access on phone"
- Make sure the app is deployed (has a URL)
- Check that your phone has internet
- If testing locally, make sure phone and computer are on same WiFi

### "Stock error when removing items"
- Another user may have taken stock before you
- The app verifies stock before transactions
- Shows actual available quantity - refresh and try again

### "Connection showing as Slow/Poor"
- This is normal on slow WiFi networks
- The app continues to work with cached data
- Operations sync automatically when connection improves

---

## 📞 Need Help?

If you're stuck:
1. Check the browser console for errors
2. Make sure environment variables are set correctly
3. Verify Supabase is configured
4. Check that the build completed successfully

---

**Your app URL will be something like:**
- `https://inventory-mandu.vercel.app` (Vercel)
- `https://inventory-mandu.netlify.app` (Netlify)
- Or a custom domain if you set one up

**Once deployed, share that URL with your team!** 🚀

---

## 📊 Capacity & Performance

The v3.0 release is optimized for:

| Metric | Capacity |
|--------|----------|
| Concurrent Users | 15-20+ on slow WiFi |
| Items | 10,000+ |
| Transactions | 100,000+ per year |
| Response Time | <100ms (cached) |
| Offline Duration | Up to 30 days cached |
