# App Distribution Guide

## Current Status: PWA (Progressive Web App) v4.0

Your app is a **Progressive Web App** - users install it directly from their browser.

**Benefits:**
- No app store required
- Free to distribute
- Instant updates (no review process)
- Works on iOS, Android, and desktop

## Install on Devices

### iPhone (Safari only)
1. Open the app URL in Safari
2. Tap Share button (square with arrow)
3. Tap "Add to Home Screen"
4. Tap "Add"

### Android (Chrome)
1. Open the app URL in Chrome
2. Look for install banner, or tap Menu → "Install app"
3. Tap "Install"

### Desktop
Just bookmark the URL or use Chrome's "Install" option.

## Share with Your Team

Send this message to your users:

```
Install Inventory Mandu App:

1. Open this link on your phone:
   https://your-app.vercel.app

2. Install:
   - iPhone: Safari → Share → "Add to Home Screen"
   - Android: Chrome → Menu → "Install app"

Features:
- Works offline
- Auto-syncs when online
- 30-day login persistence
- Shows connection quality
```

## Optional: Native App via Capacitor

If you want app store distribution:

### Setup
```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android
npx cap init
npx cap add ios
npx cap add android
npm run build
npx cap sync
```

### Distribution Options

**iOS:**
- TestFlight ($99/year Apple Developer) - Up to 10,000 testers
- App Store - Public distribution

**Android:**
- Google Play Internal Testing ($25 one-time)
- Direct APK - Send file to users

## Recommendation

**For 15-20 users: Stick with PWA**

PWA is already production-ready with:
- Offline support
- Auto-retry on failures
- Session persistence (30 days)
- No store fees
- Instant updates

Only consider native apps if you need:
- Push notifications on iOS
- App store presence
- Hardware features (camera, etc.)

## Troubleshooting

**"Can't find install option"**
- iOS: Must use Safari
- Android: Must use Chrome/Edge

**"Not staying logged in"**
- Open from home screen icon, not browser
- Don't clear browser data
- Session lasts 30 days

**"App doesn't work offline"**
- Must be deployed with HTTPS
- First visit caches the app
