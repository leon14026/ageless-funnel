#!/usr/bin/env python3
"""
Build the standalone book-chapter pages + printable QR codes for Ageless by Tulee.

Reads:  public/data/book-chapters.json  (single source of truth: n, slug, title, videos)
Writes: public/book/<slug>/index.html   (20 standalone page shells; noindex)
        book-qr-codes/<NN>.png           (raster QR, print-friendly)
        book-qr-codes/<NN>.svg           (vector QR, for print/design tools)
        book-qr-codes/contact-sheet.html (all 20 QR codes with titles, printable)

Video URLs are read at RUNTIME by book.js, so adding a video only means editing
book-chapters.json -- you do NOT need to re-run this script for that. Re-run this
script only if the chapter list/slugs change or you want to regenerate the QR codes.

Requires: qrcode (with Pillow for PNG). Both confirmed available in this environment.
"""

import json
import pathlib

import qrcode
import qrcode.image.svg
from qrcode.constants import ERROR_CORRECT_H

# ---- Paths ----
ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / "public" / "data" / "book-chapters.json"
BOOK_DIR = ROOT / "public" / "book"
QR_DIR = ROOT / "book-qr-codes"

# Production origin the QR codes point at.
BASE_URL = "https://agelessbytulee.com/book/{slug}/"

# ---- Page shell template (video URLs are loaded at runtime by book.js) ----
PAGE_TEMPLATE = """<!DOCTYPE html>
<html lang="bn">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    <title>Ageless by Tulee</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Noto+Sans+Bengali:wght@400;500;600;700&family=Playfair+Display:wght@600;700&family=Nunito:wght@400;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../book.css">
</head>
<body data-chapter="{n}">
    <main class="book-wrap">
        <div id="book-app"><div class="book-loading">লোড হচ্ছে…</div></div>
    </main>
    <script src="../book.js"></script>
</body>
</html>
"""

# ---- Contact-sheet templates ----
SHEET_HEAD = """<!DOCTYPE html>
<html lang="bn">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ageless by Tulee — Book QR Codes</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&family=Nunito:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Hind Siliguri','Nunito',system-ui,sans-serif; color:#3B1F2B; margin:0; padding:24px; background:#fff; }
        h1 { font-size:1.4rem; text-align:center; margin:0 0 4px; }
        p.sub { text-align:center; color:#8A8A8A; margin:0 0 24px; font-size:.9rem; }
        .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; }
        .cell { border:1px solid #E8E4DF; border-radius:12px; padding:14px; text-align:center; break-inside:avoid; }
        .cell img { width:150px; height:150px; }
        .num { font-weight:700; color:#3B1F2B; margin-top:8px; }
        .ttl { font-size:.82rem; color:#5A5A5A; margin-top:4px; line-height:1.35; min-height:2.6em; }
        .url { font-size:.68rem; color:#8A8A8A; margin-top:6px; word-break:break-all; }
        @media print { .grid { grid-template-columns:repeat(3,1fr); } body { padding:0; } }
    </style>
</head>
<body>
    <h1>Ageless by Tulee — Book Chapter QR Codes</h1>
    <p class="sub">Scan a code to open that chapter's video page. Print and place each in its chapter.</p>
    <div class="grid">
"""

SHEET_CELL = """        <div class="cell">
            <img src="{png}" alt="QR chapter {n}">
            <div class="num">অধ্যায় {n}</div>
            <div class="ttl">{title}</div>
            <div class="url">{url}</div>
        </div>
"""

SHEET_TAIL = """    </div>
</body>
</html>
"""


def esc(s: str) -> str:
    return (str(s).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def main() -> None:
    data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    chapters = data["chapters"]

    BOOK_DIR.mkdir(parents=True, exist_ok=True)
    QR_DIR.mkdir(parents=True, exist_ok=True)

    sheet = [SHEET_HEAD]

    for ch in chapters:
        n, slug, title = ch["n"], ch["slug"], ch["title"]
        url = BASE_URL.format(slug=slug)
        nn = f"{n:02d}"

        # 1. Page shell
        page_dir = BOOK_DIR / slug
        page_dir.mkdir(parents=True, exist_ok=True)
        (page_dir / "index.html").write_text(
            PAGE_TEMPLATE.format(n=n), encoding="utf-8")

        # 2. PNG QR (high error correction, generous quiet zone)
        qr = qrcode.QRCode(error_correction=ERROR_CORRECT_H, box_size=20, border=4)
        qr.add_data(url)
        qr.make(fit=True)
        qr.make_image(fill_color="#3B1F2B", back_color="white").save(QR_DIR / f"{nn}.png")

        # 3. SVG QR (vector, single path)
        svg = qrcode.make(
            url, error_correction=ERROR_CORRECT_H, border=4,
            image_factory=qrcode.image.svg.SvgPathImage)
        svg.save(QR_DIR / f"{nn}.svg")

        # 4. Contact-sheet cell
        sheet.append(SHEET_CELL.format(png=f"{nn}.png", n=n, title=esc(title), url=esc(url)))

    sheet.append(SHEET_TAIL)
    (QR_DIR / "contact-sheet.html").write_text("".join(sheet), encoding="utf-8")

    print(f"Built {len(chapters)} chapter pages -> {BOOK_DIR}")
    print(f"Built {len(chapters)} PNG + {len(chapters)} SVG QR codes + contact-sheet.html -> {QR_DIR}")


if __name__ == "__main__":
    main()
