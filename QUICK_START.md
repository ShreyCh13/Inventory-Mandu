# 🚀 Quick Start: Deploy & Install Your App

## Step 1: Deploy to Vercel (2 minutes)

### Option A: Using Vercel Dashboard (Easiest)

1. **Go to [vercel.com](https://vercel.com)** and sign up/login with GitHub

2. **Click "Add New Project"**

3. **Import your repository:**
   - Find `ShreyCh13/Inventory-Mandu`
   - Click "Import"

4. **Add Environment Variables:**
   - Click "Environment Variables"
   - Add these two:
     ```
     VITE_SUPABASE_URL = https://mgpingbxgjxdrcsiayds.supabase.co
     VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ncGluZ2J4Z2p4ZHJjc2lheWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTA3NDcsImV4cCI6MjA4Mzg4Njc0N30.AH01E-LxHcA7a2lT9MZ9062MAJJ-OLctJ0TWxkgPMTA
     ```

5. **Click "Deploy"** (leave all other settings as default)

6. **Wait 2-3 minutes** for deployment

7. **Copy your URL!** 
   - It will look like: `https://inventory-mandu-xxxxx.vercel.app`
   - **This is your app URL** - save it! 📝

### Option B: Using Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow prompts:
# - Link to existing project? No
# - Project name? inventory-mandu
# - Directory? ./
# - Override settings? No

# Add environment variables
vercel env add VITE_SUPABASE_URL
# Paste: https://mgpingbxgjxdrcsiayds.supabase.co

vercel env add VITE_SUPABASE_ANON_KEY
# Paste: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ncGluZ2J4Z2p4ZHJjc2lheWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTA3NDcsImV4cCI6MjA4Mzg4Njc0N30.AH01E-LxHcA7a2lT9MZ9062MAJJ-OLctJ0TWxkgPMTA

# Deploy to production
vercel --prod
```

---

## Step 2: Install on Your Phone

### 📱 iPhone (iOS)

1. **Open Safari** (not Chrome!)

2. **Go to your app URL:**
   ```
   https://your-app.vercel.app
   ```
   (Replace with your actual URL from Step 1)

3. **Tap the Share button** (square with arrow ↑) at the bottom

4. **Scroll down and tap "Add to Home Screen"**

5. **Tap "Add"** (you can edit the name if you want)

6. **Done!** ✅ The app icon is now on your home screen

### 🤖 Android

1. **Open Chrome** (or Edge/Brave)

2. **Go to your app URL:**
   ```
   https://your-app.vercel.app
   ```

3. **Look for the install banner** at the bottom:
   - Tap **"Install"** or **"Add"**

   **OR if you don't see it:**

4. **Tap the menu** (⋮) in top right

5. **Tap "Install app"** or **"Add to Home screen"**

6. **Tap "Install"** in the popup

7. **Done!** ✅ The app icon is now on your home screen

---

## Step 3: Share with Your Team

Send this message to your 10-12 users:

```
📱 Install Inventory Mandu App

🌐 Open this link on your phone:
https://your-app.vercel.app

📲 Then:

iPhone:
1. Open in Safari
2. Tap Share button (↑)
3. Tap "Add to Home Screen"
4. Tap "Add"

Android:
1. Open in Chrome
2. Tap menu (⋮)
3. Tap "Install app"
4. Tap "Install"

✅ You'll stay logged in for 30 days!
```

---

## ✅ Test It Works

1. **Open the app** from your home screen
2. **Login:**
   - Admin: `admin` / `admin123`
   - User: `mandu` / `mandu123`
3. **Close the app completely**
4. **Reopen it** - you should still be logged in! ✅

---

## 🎯 Your App URL

After deploying, your URL will be:
- **Vercel:** `https://inventory-mandu-xxxxx.vercel.app`
- **Or custom domain** if you set one up

**Find it in:**
- Vercel Dashboard → Your Project → "Domains" section
- Or check the deployment logs

---

## ❓ Troubleshooting

**"Can't find the install option"**
- iPhone: Must use Safari (not Chrome)
- Android: Must use Chrome/Edge (not Firefox)

**"App doesn't load"**
- Check that environment variables are set in Vercel
- Make sure deployment completed successfully
- Check browser console for errors

**"Not staying logged in"**
- Make sure you're opening from home screen icon (not browser)
- Don't clear browser data
- Session lasts 30 days

---

## 🎉 That's It!

Once deployed, you'll have:
- ✅ A live URL to share
- ✅ Installable PWA on iOS & Android
- ✅ 30-day login persistence
- ✅ Offline support
- ✅ Real-time sync across all devices

**Your app URL is the one Vercel gives you after deployment!** 🚀
