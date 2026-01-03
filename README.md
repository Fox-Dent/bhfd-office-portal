# BHFD Office Portal (FoxDent)

Static office portal UI for Brook Hollow Family Dentistry.
- Matches the patient scheduler theme (pastel greens + beige).
- Shows charts + a booking log table.

## Setup
1) Create a Cloudflare Worker (Office API Worker B) that exposes:
- GET /office/bookings?start=YYYY-MM-DD&end=YYYY-MM-DD&limit=250
- GET /office/analytics?start=YYYY-MM-DD&end=YYYY-MM-DD

2) In `app.js`, set:
- `OFFICE_API_BASE` to your Worker B base URL.

## Deploy (GitHub Pages)
- Repo Settings → Pages → Deploy from branch → `main` → `/root`
- Your portal will be available at your GitHub Pages URL.

## Login
This UI prompts for Basic Auth user/pass (from your Worker B env vars).
