#!/usr/bin/env python3
"""Deterministic SEO checks for image2base64.com static pages.

Checks (coach-style: script, not prompt):
  1. Exactly one <h1> per HTML page
  2. Canonical present, same host, self-consistent
     (self-canonical OK; cross-canonical to another on-site page = consolidate WARN)
  3. sitemap.xml ↔ disk: every sitemap loc has a file; every self-canonical
     page is in the sitemap (cross-canonical pages may omit — intentional)

Usage:
  python3 check_seo_consistency.py
  python3 check_seo_consistency.py --json
Exit 0 = clean (WARN OK); 1 = any FAIL.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
ORIGIN = "https://image2base64.com"
SITEMAP = ROOT / "sitemap.xml"

SKIP_NAMES = {
    "check_seo_consistency.py",
}

# Root-level HTML that is not a public indexable page
SKIP_FILES = set()


class HeadParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.h1_count = 0
        self.canonical: str | None = None
        self.title: str | None = None
        self.description: str | None = None
        self._in_title = False
        self._title_buf = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        d = {k: (v or "") for k, v in attrs}
        if tag == "h1":
            self.h1_count += 1
        elif tag == "link" and "canonical" in d.get("rel", "").lower():
            self.canonical = d.get("href") or None
        elif tag == "meta" and d.get("name", "").lower() == "description":
            self.description = d.get("content") or ""
        elif tag == "title":
            self._in_title = True
            self._title_buf = ""

    def handle_endtag(self, tag: str) -> None:
        if tag == "title" and self._in_title:
            self._in_title = False
            self.title = self._title_buf.strip()

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self._title_buf += data


def file_to_url(path: Path) -> str:
    rel = path.relative_to(ROOT).as_posix()
    if rel == "index.html":
        return ORIGIN + "/"
    if rel.endswith(".html"):
        return ORIGIN + "/" + rel[: -len(".html")]
    raise ValueError(rel)


def url_to_file(url: str) -> Path | None:
    p = urlparse(url)
    if f"{p.scheme}://{p.netloc}" != ORIGIN:
        return None
    path = p.path or "/"
    if path == "/":
        return ROOT / "index.html"
    slug = path.strip("/")
    candidate = ROOT / f"{slug}.html"
    return candidate if candidate.is_file() else None


def parse_sitemap(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    return re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", text)


def iter_pages() -> list[Path]:
    pages = []
    for p in sorted(ROOT.glob("*.html")):
        if p.name in SKIP_FILES:
            continue
        pages.append(p)
    return pages


def norm_url(u: str) -> str:
    u = u.strip()
    if u == ORIGIN:
        return ORIGIN + "/"
    return u


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    fails: list[dict] = []
    warns: list[dict] = []
    oks: list[dict] = []

    pages = iter_pages()
    page_urls = {file_to_url(p): p for p in pages}
    parsed: dict[str, HeadParser] = {}

    for path in pages:
        html = path.read_text(encoding="utf-8")
        parser = HeadParser()
        parser.feed(html)
        url = file_to_url(path)
        parsed[url] = parser
        rel = path.name

        if parser.h1_count != 1:
            fails.append(
                {
                    "check": "h1",
                    "file": rel,
                    "url": url,
                    "detail": f"expected exactly 1 <h1>, found {parser.h1_count}",
                }
            )
        else:
            oks.append({"check": "h1", "file": rel, "url": url})

        if not parser.canonical:
            fails.append(
                {
                    "check": "canonical_missing",
                    "file": rel,
                    "url": url,
                    "detail": "no <link rel=canonical>",
                }
            )
            continue

        can = norm_url(parser.canonical)
        host = f"{urlparse(can).scheme}://{urlparse(can).netloc}"
        if host != ORIGIN:
            fails.append(
                {
                    "check": "canonical_host",
                    "file": rel,
                    "url": url,
                    "detail": f"canonical off-site: {can}",
                }
            )
            continue

        if can == url:
            oks.append({"check": "canonical_self", "file": rel, "url": url})
        elif can in page_urls:
            warns.append(
                {
                    "check": "canonical_consolidate",
                    "file": rel,
                    "url": url,
                    "detail": f"canonical points to {can} (OK if intentional merge)",
                }
            )
        else:
            fails.append(
                {
                    "check": "canonical_orphan",
                    "file": rel,
                    "url": url,
                    "detail": f"canonical {can} has no matching HTML on disk",
                }
            )

        if not (parser.title or "").strip():
            warns.append({"check": "title_empty", "file": rel, "url": url, "detail": "empty <title>"})
        if not (parser.description or "").strip():
            warns.append(
                {
                    "check": "description_empty",
                    "file": rel,
                    "url": url,
                    "detail": "empty meta description",
                }
            )

    if not SITEMAP.is_file():
        fails.append({"check": "sitemap_missing", "file": "sitemap.xml", "detail": "file not found"})
        locs: list[str] = []
    else:
        locs = [norm_url(u) for u in parse_sitemap(SITEMAP)]

    for loc in locs:
        f = url_to_file(loc)
        if f is None or not f.is_file():
            fails.append(
                {
                    "check": "sitemap_phantom",
                    "url": loc,
                    "detail": "in sitemap but no matching HTML on disk",
                }
            )
        else:
            oks.append({"check": "sitemap_has_file", "url": loc, "file": f.name})

    for url, path in page_urls.items():
        parser = parsed[url]
        can = norm_url(parser.canonical) if parser.canonical else None
        if can and can != url:
            # consolidated away — may omit from sitemap
            if url in locs:
                warns.append(
                    {
                        "check": "sitemap_lists_alias",
                        "file": path.name,
                        "url": url,
                        "detail": f"page consolidates to {can} but is still listed in sitemap",
                    }
                )
            continue
        if url not in locs:
            fails.append(
                {
                    "check": "sitemap_missing_page",
                    "file": path.name,
                    "url": url,
                    "detail": "self-canonical page on disk but not in sitemap.xml",
                }
            )

    report = {
        "site": ORIGIN,
        "pages": len(pages),
        "sitemap_locs": len(locs),
        "fail": fails,
        "warn": warns,
        "ok_n": len(oks),
    }

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(f"Image2Base64 SEO consistency — {ORIGIN}")
        print(f"pages={len(pages)} sitemap_locs={len(locs)} ok={len(oks)} warn={len(warns)} fail={len(fails)}")
        for item in fails:
            print(f"FAIL  [{item['check']}] {item.get('file') or item.get('url')}: {item.get('detail')}")
        for item in warns:
            print(f"WARN  [{item['check']}] {item.get('file') or item.get('url')}: {item.get('detail')}")
        if not fails and not warns:
            print("All checks passed.")
        elif not fails:
            print("No FAILs (WARN only).")

    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
