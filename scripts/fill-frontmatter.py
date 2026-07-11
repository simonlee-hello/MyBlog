#!/usr/bin/env python3
"""Fill Hugo front matter for Simon's Blog."""

from __future__ import annotations

import argparse
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

BLOG_ROOT = Path(__file__).resolve().parent.parent
POSTS_DIR = BLOG_ROOT / "content" / "posts"
TZ = timezone(timedelta(hours=8))

CATEGORY_RULES = [
    (re.compile(r"安全|渗透|漏洞|攻防", re.I), "安全"),
    (re.compile(r"hugo|前端|编程|代码|技术|api|python|go", re.I), "技术"),
]


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    return re.sub(r"-+", "-", text).strip("-") or "untitled"


def parse_front_matter(content: str) -> tuple[dict, str]:
    if not content.startswith("---"):
        return {}, content
    parts = content.split("---", 2)
    if len(parts) < 3:
        return {}, content
    meta: dict = {}
    for line in parts[1].strip().splitlines():
        if ":" not in line:
            continue
        key, _, val = line.partition(":")
        key, val = key.strip(), val.strip().strip("'\"")
        if val.startswith("[") and val.endswith("]"):
            inner = val[1:-1].strip()
            meta[key] = [x.strip().strip("'\"") for x in inner.split(",") if x.strip()] if inner else []
        elif val.lower() in ("true", "false"):
            meta[key] = val.lower() == "true"
        else:
            meta[key] = val
    return meta, parts[2].lstrip("\n")


def extract_h1(body: str) -> str | None:
    for line in body.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return None


def extract_tags(body: str) -> list[str]:
    tags = set()
    for m in re.finditer(r"(?<!\#)\#([a-zA-Z0-9_\u4e00-\u9fff-]+)", body):
        tag = m.group(1)
        if not tag.startswith("#"):
            tags.add(tag.lower())
    return sorted(tags)


def first_paragraph(body: str) -> str:
    lines = []
    for line in body.splitlines():
        s = line.strip()
        if not s or s.startswith("#") or s == "<!--more-->":
            if lines:
                break
            continue
        lines.append(s)
    text = " ".join(lines)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"[*_`]", "", text)
    return text[:120].rstrip()


def infer_category(title: str, body: str) -> str:
    sample = f"{title}\n{body[:500]}"
    for pattern, cat in CATEGORY_RULES:
        if pattern.search(sample):
            return cat
    return "随笔"


def ensure_more(body: str) -> str:
    if re.search(r"^\s*<!--more-->\s*$", body, re.MULTILINE):
        return body
    paragraphs = body.split("\n\n")
    if len(paragraphs) <= 1:
        return body
    return paragraphs[0] + "\n\n<!--more-->\n\n" + "\n\n".join(paragraphs[1:])


def build_front_matter(meta: dict, *, publish: bool) -> str:
    date = meta.get("date") or datetime.now(TZ).strftime("%Y-%m-%dT%H:%M:%S+08:00")
    draft = meta.get("draft", not publish)
    title = meta.get("title", "Untitled")
    desc = meta.get("description", "")
    cats = meta.get("categories") or ["随笔"]
    tags = meta.get("tags") or []

    lines = [
        "---",
        f"title: '{title.replace(chr(39), chr(39) + chr(39))}'",
        f"date: '{date}'",
        f"draft: {'false' if draft is False else 'true'}",
        f"description: '{str(desc).replace(chr(39), chr(39) + chr(39))}'",
        f"categories: {cats}",
        f"tags: {tags}",
        "---",
    ]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Fill Hugo front matter")
    parser.add_argument("source", type=Path, help="Source markdown file")
    parser.add_argument("--slug", help="Output slug (filename without extension)")
    parser.add_argument("--lang", choices=("zh", "en"), default="zh", help="Target language")
    parser.add_argument("--publish", action="store_true", help="Set draft: false")
    parser.add_argument("--dry-run", action="store_true", help="Print result without writing")
    args = parser.parse_args()

    src = args.source.expanduser().resolve()
    if not src.is_file():
        print(f"Error: file not found: {src}", file=sys.stderr)
        return 1

    raw = src.read_text(encoding="utf-8")
    existing, body = parse_front_matter(raw)
    body = body.lstrip("\n")
    if body.startswith("# "):
        body = "\n".join(body.splitlines()[1:]).lstrip("\n")

    title = existing.get("title") or extract_h1(raw) or src.stem.replace("-", " ").title()
    slug = args.slug or existing.get("slug") or slugify(src.stem.replace(".en", ""))
    tags = list(dict.fromkeys((existing.get("tags") or []) + extract_tags(body)))
    category = (existing.get("categories") or [None])[0] if existing.get("categories") else None

    meta = {
        "title": title,
        "date": existing.get("date"),
        "description": existing.get("description") or first_paragraph(body),
        "categories": existing.get("categories") or [category or infer_category(title, body)],
        "tags": tags,
        "draft": existing.get("draft", not args.publish),
    }

    body = ensure_more(body)
    output_name = f"{slug}.en.md" if args.lang == "en" else f"{slug}.md"
    output = POSTS_DIR / output_name
    content = build_front_matter(meta, publish=args.publish) + "\n\n" + body + "\n"

    if args.dry_run:
        print(content)
        print(f"# → {output}", file=sys.stderr)
        return 0

    POSTS_DIR.mkdir(parents=True, exist_ok=True)
    output.write_text(content, encoding="utf-8")
    print(f"Written: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
