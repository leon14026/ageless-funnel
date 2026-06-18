#!/usr/bin/env bash
# One-off image optimizer for the Ageless by Tulee funnel.
# Downscales oversized photos to max 1600px and re-encodes WebP q80.
# Lives outside public/ so it is never served. Originals remain in git history.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PUB="$ROOT/public"
FF="/c/Users/USER/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin/ffmpeg.exe"
MAX=1600
Q=80
THRESH=409600   # only touch files larger than 400 KB

cd "$PUB" || exit 1

# Build the set of images actually referenced in served code (decode %20).
grep -rhoE "images/[^\"')> ]+\.(webp|png|jpe?g|JPG)" index.html funnel-app.js funnel-styles.css life-expectancy.html 2>/dev/null \
  | sed 's/%20/ /g' | sort -u > /tmp/ref.txt

scale="scale='min($MAX,iw)':'min($MAX,ih)':force_original_aspect_ratio=decrease"

echo "## 1) Resize/recompress USED .webp photos > 400KB (in place)"
saved=0; n=0
while IFS= read -r f; do
  case "$f" in *.webp) ;; *) continue;; esac
  [ -f "$f" ] || continue
  before=$(stat -c%s "$f"); [ "$before" -le "$THRESH" ] && continue
  tmp="${f}.opt.webp"
  if "$FF" -y -hide_banner -loglevel error -i "$f" -vf "$scale" -c:v libwebp -quality $Q "$tmp" && [ -s "$tmp" ]; then
    mv -f "$tmp" "$f"; after=$(stat -c%s "$f"); n=$((n+1)); saved=$((saved+before-after))
    printf "  %-58s %6.2f -> %5.2f MB\n" "${f#images/}" "$(awk "BEGIN{print $before/1048576}")" "$(awk "BEGIN{print $after/1048576}")"
  else
    rm -f "$tmp"; echo "  !! FAILED: $f"
  fi
done < /tmp/ref.txt
echo "   resized $n webp files, saved $(awk "BEGIN{printf \"%.1f\", $saved/1048576}") MB"

echo "## 2) Convert photo PNGs -> WebP (refs updated separately)"
for png in "images/EDITED/Edited_webp/selected/abs_1.png" "images/background.png" "images/quiz background.png"; do
  [ -f "$png" ] || continue
  out="${png%.png}.webp"
  if "$FF" -y -hide_banner -loglevel error -i "$png" -vf "$scale" -c:v libwebp -quality $Q "$out" && [ -s "$out" ]; then
    printf "  %-58s -> %5.2f MB\n" "${png#images/}" "$(awk "BEGIN{print $(stat -c%s "$out")/1048576}")"
  else echo "  !! FAILED: $png"; fi
done

echo "## 3) Downscale logo PNG in place (keep PNG for favicon)"
lg="images/Logo_without_text.png"
if [ -f "$lg" ]; then
  if "$FF" -y -hide_banner -loglevel error -i "$lg" -vf "scale='min(512,iw)':'min(512,ih)':force_original_aspect_ratio=decrease" "${lg}.tmp.png" && [ -s "${lg}.tmp.png" ]; then
    mv -f "${lg}.tmp.png" "$lg"; printf "  logo -> %5.2f MB\n" "$(awk "BEGIN{print $(stat -c%s "$lg")/1048576}")"
  else rm -f "${lg}.tmp.png"; echo "  !! logo FAILED"; fi
fi

echo "## DONE"
