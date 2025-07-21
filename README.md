# ROIROI Web

ROIROI is a browser-oriented remake of the original PyQt tool for slicing question sheets.  It uses a small Node.js backend for image processing and a lightweight client written with plain JavaScript.

## Overview

* **Frontend** – Built with [Konva](https://konvajs.org/) for interactive ROI rectangles and styled using Bootstrap.  The source lives under `src/` and is bundled with Vite.
* **Backend** – An Express server (`server.js`) exposes `/api/slice`.  Uploaded files are processed with [Sharp](https://sharp.pixelplumbing.com/) and streamed back as a ZIP archive.

## Setup

Install dependencies once:

```bash
npm install
```

### Development workflow

```bash
npm run dev
```

Vite serves the client on <http://localhost:5173>.  API calls are proxied to the same origin during development.

### Building and serving

```bash
npm run build   # outputs to dist/
npm run serve   # start Express on http://localhost:3000
```

After running the above commands, open <http://localhost:3000> to use the application.  Upload an image, create Y‑ROIs and an optional X‑ROI, then click **保存** to download `slices.zip`.

The viewer automatically scales large images down to fit the canvas and scales
small images up with a pixel grid so ROIs always match the original pixel
coordinates.

## File layout

```
├─ server.js          # Express API and static file host
├─ src/               # Client-side code (HTML, JS, CSS)
├─ dist/              # Generated production files (ignored in git)
└─ vite.config.js     # Build configuration
```

The project focuses on a minimal setup so that the built `dist/` folder can be deployed as a static site along with `server.js` for slicing.
