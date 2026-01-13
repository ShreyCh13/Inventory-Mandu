# QuickStock Pro

A fast and efficient inventory management application built with React, Vite, and Tailwind CSS.

## Features

- 📦 Track inventory items and stock levels
- 📁 Organize items into folders
- 📊 Dashboard overview
- 📜 Transaction history log
- 🔄 Google Sheets integration for syncing

## Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```

2. (Optional) Set environment variables in `.env.local`:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Build for Production

```bash
npm run build
```

The build output will be in the `dist` folder.

## Deploy

### Vercel (Recommended)

1. Push your code to GitHub
2. Import your repository on [Vercel](https://vercel.com)
3. Vercel will auto-detect Vite and deploy

Or deploy with CLI:
```bash
npx vercel
```

### Netlify

1. Push your code to GitHub
2. Import your repository on [Netlify](https://netlify.com)
3. Netlify will use the included `netlify.toml` config

Or deploy with CLI:
```bash
npx netlify deploy --prod
```

### Manual / Other Platforms

1. Run `npm run build`
2. Upload the `dist` folder to your hosting provider
3. Configure your server to serve `index.html` for all routes (SPA fallback)

## Tech Stack

- **React 19** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **TypeScript** - Type safety

## Project Structure

```
├── App.tsx              # Main app component
├── index.tsx            # Entry point
├── index.html           # HTML template
├── index.css            # Tailwind CSS imports
├── types.ts             # TypeScript types
├── components/
│   ├── Dashboard.tsx    # Dashboard view
│   ├── HistoryLog.tsx   # Transaction history
│   ├── ItemManager.tsx  # Item CRUD operations
│   ├── TransactionForm.tsx
│   ├── SyncSettings.tsx # Google Sheets setup
│   └── Icons.tsx        # SVG icons
├── vercel.json          # Vercel config
├── netlify.toml         # Netlify config
└── vite.config.ts       # Vite config
```

## License

MIT
