---
title: "Hugo + LoveIt Blog Optimization Notes: From Setup to a Reproducible Config"
date: 2026-07-13T09:44:50+08:00
draft: false
description: "A reproducible walkthrough of optimizing a Hugo Extended + LoveIt blog: bilingual content, Cloudflare deploy, Giscus, Busuanzi, and the publish workflow."
categories: ["blog"]
tags: ["hugo", "loveit", "cloudflare", "giscus", "busuanzi"]
featuredImage: "/images/posts/hugo-loveit-blog-optimization-notes/featured.jpg"
featuredImagePreview: "/images/posts/hugo-loveit-blog-optimization-notes/featured.jpg"
---

A practical recap of the optimizations applied to this site, so the setup can be reproduced against the current repository.

- Site: https://blog.leeissonba.com/
- Theme: [LoveIt](https://github.com/dillonzq/LoveIt) · Hosting: Cloudflare Workers static assets
- Repo: https://github.com/simonlee-hello/MyBlog

<!--more-->

## 1. Background and goals

This personal blog runs on Hugo Extended + LoveIt, with these requirements:

- Chinese as the default language, with an English switch
- Draft in Obsidian / Typora, then auto-fill front matter, cover image, English version, and publish
- Deploy on Cloudflare with a custom domain
- Comments, on-page counters, and backend analytics each in place
- Code blocks and videos that do not break the layout

Each section lists paths and config points that match the current repo.

---

## 2. Project layout and local commands

This chapter defines the repository layout, local commands, and ignore rules—the baseline for template overrides, styles, and deploy.

### 2.1 Key directories

```text
.
├── archetypes/          # new-post templates
├── assets/css/          # _custom.scss theme overrides
├── content/posts/       # posts (zh .md / en .en.md)
├── drafts/              # local drafts (gitignored)
├── layouts/             # theme overrides (do not edit themes/LoveIt)
├── static/              # images, videos, favicon
├── themes/LoveIt/       # Git submodule
├── .cursor/skills/      # hugo-blog-publish / loveit-theme
├── build.sh / wrangler.jsonc / package.json  # Cloudflare build
├── hugo.toml
└── Makefile
```

### 2.2 Common commands

```bash
make dev      # hugo server -D
make build    # HUGO_ENV=production hugo --minify
make clean
```

{{< admonition note >}}
LoveIt loads comments, CDN, and some analytics scripts only when `hugo.Environment == production`. To verify comments locally, run: `HUGO_ENV=production hugo server`
{{< /admonition >}}

### 2.3 `.gitignore`

`public/`, `resources/`, `.hugo_build.lock`, `.cache/`, and `drafts/` are ignored.

- **Does not block deploy**: Cloudflare rebuilds `public/` with `hugo build` in CI; the repo does not need build artifacts.
- Keep `drafts/` local; publish into `content/posts/` after review.

---

## 3. Fixing Hugo deprecation warnings

Newer Hugo warns about `.Site.LanguageCode`, `.Language.LanguageName`, `.Sites`, and the `languageCode` config key.

**Rule**: do not edit the theme submodule; override templates under project `layouts/`.

| Override file | Change |
|---------------|--------|
| `layouts/baseof.html` | use `.Site.Language.Locale` for `lang` |
| `layouts/_partials/header.html` | language switch via `hugo.Sites` and `.Language.Label` |
| `layouts/_partials/head/seo.html` | Locale as above |
| `layouts/_partials/init.html` | drop noisy dev warnings; attach comment / analytics in production |
| `layouts/home.rss.xml` and other RSS | Locale as above |

On the config side, use `locale` (this site: Chinese `zh-CN`, English `en`) instead of deprecated `languageCode`.

---

## 4. Chinese default and bilingual content rules

Default language and file naming must stay consistent, or the language switch shows an empty post list.

### 4.1 Site languages

In `hugo.toml`:

- `defaultContentLanguage = "zh-cn"`
- `[languages.zh-cn]` with a smaller weight (primary)
- `[languages.en]` for the English site

### 4.2 File naming (important)

When Chinese is the default:

| Language | Path |
|----------|------|
| Chinese | `content/posts/{slug}.md` (**do not** use `.zh-cn.md`) |
| English | `content/posts/{slug}.en.md` |

About pages follow the same pattern: `content/about/index.md` + `index.en.md`.

If English lives in bare `.md` and Chinese in `.zh-cn.md`, switching to `/en/` will hide English posts—an early footgun on this site.

### 4.3 Social links

Set `[params.home.profile] social = true` and configure `[params.social]` (GitHub, Email, RSS, etc.). Icons appear on the home profile only then.

---

## 5. Writing and publish workflow

Conventions from draft to live: front matter, covers, media paths, and how Cursor skills help publish.

### 5.1 Minimal publish flow

1. Write Chinese Markdown in Obsidian / Typora / `drafts/`
2. Publish with Cursor skill **`hugo-blog-publish`** (default: front matter, cover, English translation, `hugo build`, commit + push)
3. Skip push when only local verification is requested; skip `.en.md` when Chinese-only is requested

### 5.2 Front matter convention

```yaml
---
title: ""
date: 2026-07-13T12:00:00+08:00
draft: false
description: ""
categories: []
tags: []
featuredImage: "/images/posts/{slug}/featured.jpg"
featuredImagePreview: "/images/posts/{slug}/featured.jpg"
---
```

- Insert `<!--more-->` after the first paragraph for the summary
- Chinese and English share the same cover / media paths

### 5.3 Media paths

| Type | Directory | In-content URL |
|------|-----------|----------------|
| Cover / images | `static/images/posts/{slug}/` | `/images/posts/{slug}/...` |
| Videos | `static/videos/posts/{slug}/` | `/videos/posts/{slug}/...` |

Recommended video markup:

```html
<video controls playsinline preload="metadata" src="/videos/posts/{slug}/demo.mp4"></video>
```

External image URLs and Bilibili / YouTube embeds stay as-is; Bilibili can use LoveIt's `bilibili` shortcode.

### 5.4 LoveIt writing skill

There is also a **`loveit-theme`** skill (linked from publish): quick reference for admonition, image, mermaid, math, Giscus, Busuanzi, and more. Publish may lightly upgrade tips to `admonition` or Bilibili links to shortcodes.

Official docs: [LoveIt](https://hugoloveit.com).

---

## 6. Layout fixes: code and video

Production issues: long code lines overflow the code box; `<video>` width did not match content width. Fixed in `assets/css/_custom.scss`:

- Code blocks: `max-width: 100%`, `overflow-x: auto`, `pre-wrap` when needed
- `video`: `width/max-width: 100%`, `display: block`, `height: auto`

Still wrap extremely long command lines in the source for readability.

---

## 7. Deploy to Cloudflare Workers

Static hosting follows the [official Hugo Cloudflare guide](https://gohugo.io/host-and-deploy/host-on-cloudflare/); this site uses Workers static assets.

### 7.1 Repo files

| File | Role |
|------|------|
| `wrangler.jsonc` | Worker name (e.g. `simons-blog`), `assets.directory = ./public` |
| `build.sh` | Install Hugo Extended, update submodule, `HUGO_ENV=production hugo build` |
| `package.json` | Helps enable build cache |

The Cloudflare project name should match `name` in `wrangler.jsonc`.

### 7.2 Dashboard notes

- Static-only Worker: **do not** set `HUGO_BASEURL` under runtime Variables and Secrets
- Put build-related vars under **Build variables**, or hardcode `baseURL` in `hugo.toml` (this site uses `https://blog.leeissonba.com`)
- Bind the custom domain under Workers → Domains

### 7.3 Submodule

The theme is a submodule. Cloudflare build must run `git submodule update --init --recursive`; local clones need the submodule too.

---

## 8. Comments: Giscus

Valine (LeanCloud) was considered; the site settled on [Giscus](https://giscus.app/) (GitHub Discussions).

### 8.1 Prerequisites

1. Repository is **Public**
2. **Discussions** enabled
3. Install the [giscus GitHub App](https://github.com/apps/giscus) and grant this repo

### 8.2 Site config (`hugo.toml`)

```toml
[params.page.comment]
  enable = true
  [params.page.comment.giscus]
    enable = true
    repo = "simonlee-hello/MyBlog"
    repoId = "R_kgDOTVNnWg"
    category = "Announcements"
    categoryId = "DIC_kwDOTVNnWs4DBC6N"
    mapping = "pathname"
```

`repoId` / `categoryId` are public GitHub GraphQL node IDs. They appear in page source and are **not secrets**—safe to publish with the site config.

Disable per page with `comment: false`.  
Loaded only in production builds; locally use `HUGO_ENV=production`.

Comment data lives in the repo's Discussions.

---

## 9. Analytics: two complementary layers

| Purpose | Tool | Notes |
|---------|------|-------|
| Owner dashboard | Cloudflare Web Analytics | Zone covers `leeissonba.com`; `blog.*` traffic already shows up—filter by Host |
| On-page numbers | [Busuanzi](https://busuanzi.ibruce.info/) | Footer site PV/UV + post meta page views |

Cloudflare Web Analytics **cannot** render counts on the public page (no public front-end API). On-page counters follow [Hugo + Busuanzi on LoveIt](https://stilig.me/posts/hugo-adds-busuanzi/):

- `layouts/_partials/plugin/busuanzi.html`
- `layouts/_partials/footer.html` (site-wide)
- `layouts/posts/single.html` (per post)
- `[params.busuanzi]` toggles and label prefixes

Implementation notes:

- Load the script **once in the footer** to avoid double counting
- Use official container ids such as `busuanzi_container_site_pv`
- Prefer `site_pv_pre` for site PV prefixes (the reference post once used `page_pv_pre` by mistake)

---

## 10. Config switch cheat sheet

```toml
# comments
[params.page.comment]
  enable = true

# Busuanzi
[params.busuanzi]
  enable = true

# home social icons
[params.home.profile]
  social = true
```

Keep theme overrides under project `layouts/` and `assets/` so LoveIt submodule upgrades stay smaller.

---

## 11. Reproduction checklist

When aligning a fresh copy with this site:

1. [ ] Hugo Extended + `git submodule update --init`
2. [ ] `hugo.toml`: `baseURL`, default language, social, Giscus, Busuanzi
3. [ ] Cloudflare project name matches `wrangler.jsonc` `name`
4. [ ] `layouts/` deprecation overrides + busuanzi / footer / posts/single
5. [ ] `assets/css/_custom.scss` for code and video
6. [ ] Cloudflare: connected repo, build script, custom domain, `HUGO_ENV=production`
7. [ ] Giscus App installed; Discussions enabled
8. [ ] (Optional) Web Analytics filter for `blog.` host
9. [ ] Cursor skills: `hugo-blog-publish` + `loveit-theme`
10. [ ] Smoke-test one post: bilingual, `featuredImage`, local media paths, `<!--more-->`

---

## 12. References

- [LoveIt docs](https://hugoloveit.com)
- [Host on Cloudflare (Hugo)](https://gohugo.io/host-and-deploy/host-on-cloudflare/)
- [Giscus](https://giscus.app/)
- [Busuanzi](https://busuanzi.ibruce.info/)
- [Hugo visit counters (LoveIt + Busuanzi)](https://stilig.me/posts/hugo-adds-busuanzi/)
- Cloudflare Dashboard → Analytics & Logs → Web Analytics
