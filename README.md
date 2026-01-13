# QuickStock Pro

A fast inventory management app with **live Google Sheets backup**.

## 🚀 Deploy for FREE

### Option 1: Vercel (Recommended)

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com) → Import your repo
3. Click **Deploy** - done!

**Free tier includes:** Unlimited deployments, custom domain, HTTPS

### Option 2: Netlify

1. Push code to GitHub
2. Go to [netlify.com](https://netlify.com) → Import your repo
3. Click **Deploy** - done!

**Free tier includes:** 100GB bandwidth/month, custom domain, HTTPS

---

## 📊 Google Sheets Live Backup (FREE)

Your app already has built-in Google Sheets sync! Here's how to set it up:

### Step 1: Create Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) → Create new spreadsheet
2. Name it "QuickStock Backup"
3. Add headers in Row 1:
   ```
   Date | Item | Folder | Type | Qty | Unit | User | Reason
   ```

### Step 2: Add Google Apps Script

1. In your sheet, click **Extensions → Apps Script**
2. Delete any code and paste this:

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
    data.reason
  ]);
  return ContentService.createTextOutput("OK");
}
```

3. Click **Deploy → New Deployment**
4. Select type: **Web app**
5. Set "Who has access" to: **Anyone**
6. Click **Deploy**
7. **Copy the Web App URL**

### Step 3: Connect Your App

1. In QuickStock Pro, click the ⚙️ **Settings** icon
2. Paste the Web App URL
3. Click **Save & Connect**

✅ Now every transaction auto-syncs to your Google Sheet in real-time!

---

## 💾 Data Storage

| Data | Storage | Backup |
|------|---------|--------|
| Inventory items | Browser localStorage | Manual export |
| Transactions | Browser localStorage | Auto-sync to Google Sheets |
| Settings | Browser localStorage | - |

**Note:** localStorage persists in your browser. For multi-device access, use the Google Sheets backup as your source of truth.

---

## 🛠 Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📦 Build

```bash
npm run build
```

Output in `dist/` folder.

---

## Tech Stack

- React 19
- Vite
- Tailwind CSS (CDN)
- TypeScript
