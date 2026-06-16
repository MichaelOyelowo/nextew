# Nextew — Client-side Image Tools

Nextew is a lightweight client-side image toolkit built with React + Vite. It provides in-browser image conversion, compression, SVG export, and a prompt-driven background-removal UI (BG removal UI is UI-only — AI processing requires a backend/API).

Features
- Multi-format conversion: AVIF, WEBP, JPEG, PNG (client-side)
- Convert images to multiple formats at once and download individual files or a ZIP bundle
- Client-side compression using `browser-image-compression`
- SVG exporter (wraps raster images inside an SVG for easy embedding)
- BG Remove page with AI-style prompt UI (UI ready; backend integration required for real AI processing)

Tech stack
- Vite
- React
- browser-image-compression
- JSZip

Quick start
1. Install dependencies

```bash
npm install
```

2. Run local dev server

```bash
npm run dev
```

3. Build for production

```bash
npm run build
```

How to use (quick)
- Open the app in the browser (`npm run dev`).
- Use the Convert page to choose target formats, upload images, and convert.
- Select multiple output formats and click `Convert` (or enable `Convert automatically`).
- Download single formats or use `Download all as ZIP` to get an organized ZIP of results.
- Use the SVG page to export an image into a simple SVG wrapper.
- Use the Remove BG page to enter prompt instructions (e.g., "Reduce to 200KB and convert to webp") — this page prepares client-side conversions and is ready for backend AI integration for real background removal.

Notes & limitations
- AVIF export support depends on the browser. The app detects AVIF support and falls back when necessary.
- Background removal (actual object-background separation) is not implemented client-side — it requires a server or third-party API. The UI includes a prompt assistant to specify desired processing.

Routes
- `/convert` — multi-format conversion UI
- `/svg-converter` — SVG export page
- `/remove-bg` — prompt-driven BG Remove page (UI only)
- `/resize` — resize utility (placeholder)

Deployment
- Push to GitHub and connect the repo to Vercel for automatic builds and deployments.
- Vercel will run `npm run build` during deployment — no extra steps required.

Example Git commands

```bash
git add .
git commit -m "Add README and project docs"
git push origin main
```

Contributing
- Fork, create a feature branch, and open a pull request. Keep changes focused and add tests where appropriate.
