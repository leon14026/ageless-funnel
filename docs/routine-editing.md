# Editing the workout routine

The member **Programs** section is driven by two committed files — **no database**:

- `public/data/routine.json` — the structure (6 months × 7 days × video blocks). **Generated** from the Excel.
- `public/data/videos.json` — a map of **"Exercise name" → "YouTube URL"**. **This is where you add videos.**

A blank URL renders a **"Coming soon"** box on the site (the exercise name/duration still show).

## Add or change a video (the everyday task)
1. Upload the video to **YouTube → Unlisted**; copy the link.
2. Open **`public/data/videos.json`**. Find the exercise name (they match the Excel "Exercise Name").
3. Paste the URL as its value, e.g.:
   ```json
   "5 Min Warm Up": "https://youtu.be/abc123",
   "Old Warm-Up Stretch - Red Tree, Tariqul": "https://youtu.be/def456"
   ```
   Each name is filled **once** and applies to **every day it appears** (the warm-up & cool-down repeat daily).
4. Commit + push — Cloudflare redeploys and the block starts playing.

## Change the routine itself (exercises, days, months)
Source of truth: **`routine-source/routine.xlsm`** (only the 6 "Routine N - Month N" sheets are read).
1. Edit the Excel.
2. Regenerate (Python standard library only — no installs), from the repo root:
   ```
   python tools/build_routine.py
   ```
   This rewrites `routine.json` and **merges** `videos.json` (keeps the URLs you've already filled, adds any new exercise names).
3. Commit + push.

## Notes
- **Day 7 is a rest day** — it shows a recovery panel, no videos, and doesn't count toward workout-day progress.
- Progress ("Mark day complete") is stored per-device in the browser (`localStorage`) for now; it can move to
  Supabase later for cross-device sync.
