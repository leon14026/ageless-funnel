# Ageless by Tulee — Book Chapter QR Codes

These QR codes link each printed book chapter to its private video page on
`agelessbytulee.com`. The pages are **not linked from anywhere** — the QR code
(or the exact link) is the only way in.

## Files
- `01.png … 20.png` — raster QR codes (good for most print workflows).
- `01.svg … 20.svg` — vector QR codes (sharpest for InDesign/Illustrator, any size).
- `contact-sheet.html` — open in a browser to see/print all 20 with their titles.

Each code `NN` points to `https://agelessbytulee.com/book/chNN/`.

## Adding / changing the videos (no rebuild needed)
Edit **`public/data/book-chapters.json`** and put 1–2 unlisted YouTube URLs in a
chapter's `videos` array, e.g.:

```json
{ "n": 1, "slug": "ch01", "title": "…", "videos": ["https://youtu.be/abc123XYZ90", ""] }
```

Save, commit, push — the page updates automatically. A blank string shows a
"coming soon" box. Full `watch?v=`, `youtu.be/`, or `/embed/` links all work.

## Regenerating the pages + QR codes
Only needed if the chapter list or slugs change:

```bash
python tools/build_book.py
```
