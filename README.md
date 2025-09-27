# Nidhi Surekha — Minimal Portfolio

This is a minimal static portfolio you can open directly in your browser.

Files created:
- `index.html` — homepage
- `styles/main.css` — styling
- `scripts/main.js` — small interactivity (year, mobile nav)
- `assets/*` — placeholder SVGs for hero and projects

Preview locally (PowerShell):

```powershell
cd "c:\Users\nidhi\Desktop\Portfolio"
# Option A: open file directly
start .\index.html

# Option B: serve with Python (recommended for relative assets)
py -3 -m http.server 8000
# then open http://localhost:8000
```

Replace the placeholder SVGs in `assets/` with your screenshots or exported images. Update contact email and project copy in `index.html`.

Next suggestions:
- Convert to React (components + routing)
- Add a dark/light toggle and simple animations
- Deploy to GitHub Pages, Netlify or Vercel
