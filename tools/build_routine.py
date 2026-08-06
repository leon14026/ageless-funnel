#!/usr/bin/env python3
"""
Build the member workout routine data from the source Excel workbook.

  Source : routine-source/routine.xlsm   (the 6 "Routine N - Month N" sheets)
  Output : public/data/routine.json       (structure: months -> days -> blocks)
           public/data/videos.json        (unique exercise name -> YouTube URL)

Adding videos: fill in the URLs in public/data/videos.json (one entry per unique
exercise name; a blank URL shows a "Coming soon" box on the site). Re-running this
script MERGES: it keeps URLs you've already filled and only adds newly-seen names.

Python standard library only - no pip installs. Run from the repo root:
  python tools/build_routine.py
"""
import json, os, re, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "routine-source", "routine.xlsm")
OUT_ROUTINE = os.path.join(ROOT, "public", "data", "routine.json")
OUT_VIDEOS = os.path.join(ROOT, "public", "data", "videos.json")


def clean(s):
    if s is None:
        return ""
    s = str(s)
    s = s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&#39;", "'").replace("&quot;", '"')
    # normalise the various dash/space glyphs Excel uses
    for bad in ("–", "—", "‒", "�"):
        s = s.replace(bad, "-")
    return re.sub(r"\s+", " ", s).strip()


def col_of(ref):
    return re.match(r"[A-Z]+", ref).group()


def category_of(name):
    n = name.lower()
    if re.search(r"warm[\s-]?up", n):
        return "warmup"
    if re.search(r"cool[\s-]?down", n):
        return "cooldown"
    return "workout"


def load_shared_strings(z):
    if "xl/sharedStrings.xml" not in z.namelist():
        return []
    ss = z.read("xl/sharedStrings.xml").decode("utf-8", "ignore")
    out = []
    for si in re.findall(r"<si>(.*?)</si>", ss, re.S):
        texts = re.findall(r"<t[^>]*>(.*?)</t>", si, re.S)
        out.append(clean("".join(texts)))
    return out


def sheet_files(z):
    """Return list of (name, worksheet_path) in workbook order."""
    wb = z.read("xl/workbook.xml").decode("utf-8", "ignore")
    rels = z.read("xl/_rels/workbook.xml.rels").decode("utf-8", "ignore")
    relmap = dict(re.findall(r'<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"', rels))
    out = []
    for m in re.finditer(r"<sheet\b[^>]*>", wb):
        tag = m.group()
        name = re.search(r'name="([^"]+)"', tag)
        rid = re.search(r'r:id="([^"]+)"', tag)
        if not (name and rid):
            continue
        target = relmap.get(rid.group(1), "")
        if target and not target.startswith("xl/"):
            target = "xl/" + target
        out.append((clean(name.group(1)), target))
    return out


def parse_rows(z, path, shared):
    xml = z.read(path).decode("utf-8", "ignore")
    rows = []
    for r in re.findall(r"<row\b[^>]*>(.*?)</row>", xml, re.S):
        cells = {}
        for ref, attr, body in re.findall(r'<c r="([A-Z]+\d+)"([^>]*)>(.*?)</c>', r, re.S):
            v = re.findall(r"<v>(.*?)</v>", body, re.S)
            if v:
                val = v[0]
                if 't="s"' in attr:
                    val = shared[int(val)]
                cells[col_of(ref)] = clean(val)
            else:
                istr = re.findall(r"<t[^>]*>(.*?)</t>", body, re.S)
                if istr:
                    cells[col_of(ref)] = clean("".join(istr))
        if cells:
            rows.append(cells)
    return rows


def build_month(name, rows):
    mnum = re.search(r"Month\s*(\d+)", name)
    month = int(mnum.group(1)) if mnum else None

    title, description = "", ""
    # rows[0] = big title, rows[1] = description (best-effort)
    if rows:
        title = rows[0].get("A", "")
    if len(rows) > 1:
        description = rows[1].get("A", "")

    days = []
    cur = None
    for cells in rows:
        a = cells.get("A", "")
        dm = re.match(r"Day\s*(\d+)", a)
        if dm:
            if cur:
                days.append(cur)
            is_rest = "REST" in a.upper()
            theme = cells.get("B", "")
            theme = re.sub(r"^Theme:\s*", "", theme) if theme and not theme.isdigit() else ""
            cur = {"day": int(dm.group(1)), "theme": theme, "rest": is_rest, "note": "", "blocks": []}
            continue
        if cur is None:
            continue
        name_c = cells.get("C", "")
        if cur["rest"]:
            # capture any recovery note text for the rest day
            note = name_c or (cells.get("B", "") if not cells.get("B", "").isdigit() else "")
            if note:
                cur["note"] = (cur["note"] + " " + note).strip()
            continue
        if name_c:
            cur["blocks"].append({
                "name": name_c,
                "duration": cells.get("D", ""),
                "page": cells.get("E", ""),
                "category": category_of(name_c),
            })
    if cur:
        days.append(cur)
    days.sort(key=lambda d: d["day"])
    return {"month": month, "title": title, "description": description, "days": days}


def main():
    if not os.path.exists(SRC):
        sys.exit("Source not found: " + SRC)
    z = zipfile.ZipFile(SRC)
    shared = load_shared_strings(z)

    months = []
    for name, path in sheet_files(z):
        if not re.search(r"Routine\s*\d+.*Month\s*\d+", name) or not path:
            continue
        months.append(build_month(name, parse_rows(z, path, shared)))
    months.sort(key=lambda m: (m["month"] is None, m["month"]))

    # Unique exercise names -> URL (merge with any existing filled URLs)
    existing = {}
    if os.path.exists(OUT_VIDEOS):
        try:
            existing = json.load(open(OUT_VIDEOS, encoding="utf-8"))
        except Exception:
            existing = {}
    videos = {}
    for m in months:
        for d in m["days"]:
            for b in d["blocks"]:
                videos.setdefault(b["name"], existing.get(b["name"], ""))

    os.makedirs(os.path.dirname(OUT_ROUTINE), exist_ok=True)
    json.dump({"months": months}, open(OUT_ROUTINE, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    json.dump(dict(sorted(videos.items())), open(OUT_VIDEOS, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    filled = sum(1 for v in videos.values() if v)
    print("Months: %d" % len(months))
    for m in months:
        wd = sum(1 for d in m["days"] if not d["rest"])
        print("  Month %s: %d days (%d workout), title=%r" % (m["month"], len(m["days"]), wd, m["title"][:40]))
    print("Unique exercise videos: %d (%d have URLs, %d coming soon)" % (len(videos), filled, len(videos) - filled))
    print("Wrote %s and %s" % (OUT_ROUTINE, OUT_VIDEOS))


if __name__ == "__main__":
    main()
