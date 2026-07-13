---
title: "Hugo + LoveIt 博客优化复盘：从搭建到可复现配置"
date: 2026-07-13T09:44:50+08:00
draft: false
description: "汇总 Hugo Extended + LoveIt 博客从搭建到可复现配置的优化步骤：双语约定、Cloudflare 部署、Giscus、不蒜子与发布工作流。"
categories: ["博客"]
tags: ["hugo", "loveit", "cloudflare", "giscus", "busuanzi"]
featuredImage: "/images/posts/hugo-loveit-blog-optimization-notes/featured.jpg"
featuredImagePreview: "/images/posts/hugo-loveit-blog-optimization-notes/featured.jpg"
---

汇总本站自搭建以来的优化与落地步骤，便于对照仓库复现。

- 站点：https://blog.leeissonba.com/
- 主题：[LoveIt](https://github.com/dillonzq/LoveIt) · 部署：Cloudflare Workers 静态资源
- 仓库：https://github.com/simonlee-hello/MyBlog

<!--more-->

## 1. 背景与目标

个人博客基于 Hugo Extended + LoveIt，需要同时满足：

- 中文为默认语言，英文可切换阅读
- 从 Obsidian / Typora 写稿，尽量自动补 front matter、配图、英文版并发布
- 部署到 Cloudflare，绑定自定义域名
- 评论、前台阅读量、后台访客分析各自就位
- 代码块 / 视频等排版不翻车

各节给出对应路径与配置要点，可直接对照仓库当前状态。

---

## 2. 项目骨架与本地命令

本章约定仓库布局、本地命令与忽略规则，是后续覆盖模板、样式与部署的前提。

### 2.1 关键目录

```text
.
├── archetypes/          # 新建文章模板
├── assets/css/          # _custom.scss 覆盖主题样式
├── content/posts/       # 文章（中文 .md / 英文 .en.md）
├── drafts/              # 本地草稿（已 gitignore，不进仓库）
├── layouts/             # 覆盖主题模板（勿改 themes/LoveIt）
├── static/              # 图片、视频、favicon
├── themes/LoveIt/       # Git submodule
├── .cursor/skills/      # hugo-blog-publish / loveit-theme
├── build.sh / wrangler.jsonc / package.json  # Cloudflare 构建
├── hugo.toml
└── Makefile
```

### 2.2 常用命令

```bash
make dev      # hugo server -D
make build    # HUGO_ENV=production hugo --minify
make clean
```

{{< admonition note >}}
LoveIt 的评论、CDN、部分分析脚本只在 `hugo.Environment == production` 时启用。本地验证评论请运行：`HUGO_ENV=production hugo server`
{{< /admonition >}}

### 2.3 `.gitignore`

`public/`、`resources/`、`.hugo_build.lock`、`.cache/`、`drafts/` 已忽略。

- **不影响发布**：Cloudflare 构建时在 CI 里重新 `hugo build` 生成 `public/`，不依赖仓库里的产物。
- `drafts/` 只留在本机，审稿通过后再发布到 `content/posts/`。

---

## 3. Hugo 弃用 API 修复

新版 Hugo 对 `.Site.LanguageCode`、`.Language.LanguageName`、`.Sites`、配置项 `languageCode` 等发出弃用警告。

**原则**：不改 submodule 内主题源码，在项目 `layouts/` 覆盖对应模板。

| 覆盖文件 | 调整要点 |
|----------|----------|
| `layouts/baseof.html` | `lang` 用 `.Site.Language.Locale` |
| `layouts/_partials/header.html` | 语言切换用 `hugo.Sites`、`.Language.Label` |
| `layouts/_partials/head/seo.html` | Locale 同上 |
| `layouts/_partials/init.html` | 去掉开发环境多余 warn；生产环境再挂 comment / analytics |
| `layouts/home.rss.xml` 等 RSS | Locale 同上 |

配置侧：语言块使用 `locale`（本站中文为 `zh-CN`，英文为 `en`），不再依赖已弃用的 `languageCode` 写法。

---

## 4. 中文默认与双语内容约定

默认语言与文件命名必须一致，否则语言切换后文章列表会空。

### 4.1 站点语言

`hugo.toml`：

- `defaultContentLanguage = "zh-cn"`
- `[languages.zh-cn]` weight 更小（优先）
- `[languages.en]` 为英文站

### 4.2 文件命名（重要）

默认语言是中文时：

| 语言 | 路径 |
|------|------|
| 中文 | `content/posts/{slug}.md`（**不要**用 `.zh-cn.md`） |
| 英文 | `content/posts/{slug}.en.md` |

About 页同理：`content/about/index.md` + `index.en.md`。

若把英文写在无后缀的 `.md`、中文写成 `.zh-cn.md`，切换到 `/en/` 时会看不到英文文章——这是早期踩过的坑。

### 4.3 社交媒体

`[params.home.profile] social = true`，并配置 `[params.social]`（如 GitHub、Email、RSS）。首页 Profile 才会显示社交图标。

---

## 5. 内容写作与发布工作流

从草稿到上线的约定：front matter、配图、媒体路径，以及 Cursor skill 如何协助发布。

### 5.1 发布流程（最小集）

1. 在 Obsidian / Typora / `drafts/` 写中文 Markdown
2. 用 Cursor skill **`hugo-blog-publish`** 发布（默认：补 front matter、配图、译英文、`hugo build`、commit + push）
3. 若指定仅本地验证则跳过 push；若指定仅中文则不生成 `.en.md`

### 5.2 front matter 约定

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

- 第一段后插入 `<!--more-->` 作为摘要分隔
- 中英文共用同一套配图 / 媒体路径

### 5.3 媒体路径

| 类型 | 目录 | 正文引用 |
|------|------|----------|
| 配图 / 插图 | `static/images/posts/{slug}/` | `/images/posts/{slug}/...` |
| 视频 | `static/videos/posts/{slug}/` | `/videos/posts/{slug}/...` |

视频推荐：

```html
<video controls playsinline preload="metadata" src="/videos/posts/{slug}/demo.mp4"></video>
```

外链图、Bilibili / YouTube 不强制下载进仓库；B 站可用 LoveIt `bilibili` shortcode。

### 5.4 LoveIt 写作技巧 skill

另有 **`loveit-theme`** skill（与 publish 联动）：admonition、image、mermaid、math、Giscus、不蒜子等速查。发布时会按需把提示改成 `admonition`、B 站链接改成 shortcode 等。

官方文档见 [LoveIt](https://hugoloveit.com)。

---

## 6. 排版修复：代码与视频

线上曾出现：超长代码行撑破代码框；`<video>` 宽度与正文不一致。在 `assets/css/_custom.scss` 中处理：

- 代码块：`max-width: 100%`、`overflow-x: auto`、必要时 `pre-wrap`
- `video`：`width/max-width: 100%`、`display: block`、`height: auto`

正文侧仍建议对极长命令行适度断行，观感更好。

---

## 7. 部署到 Cloudflare Workers

静态站点按 [Hugo 官方 Cloudflare 文档](https://gohugo.io/host-and-deploy/host-on-cloudflare/) 接入；本站使用 Workers 静态资源模式。

### 7.1 仓库内文件

| 文件 | 作用 |
|------|------|
| `wrangler.jsonc` | Worker 名（如 `simons-blog`）、`assets.directory = ./public` |
| `build.sh` | 安装 Hugo Extended、更新 submodule、`HUGO_ENV=production hugo build` |
| `package.json` | 便于构建缓存 |

Cloudflare 控制台中的项目名应与 `wrangler.jsonc` 的 `name` 保持一致。

### 7.2 Dashboard 注意点

- 纯静态 Worker：**不要**在「变量和密钥」（运行时）里配 `HUGO_BASEURL`
- 构建相关变量应放在 **Build variables**，或直接写死 `hugo.toml` 的 `baseURL`（本站已用 `https://blog.leeissonba.com`）
- 自定义域名在 Workers → Domains 绑定即可

### 7.3 submodule

主题是 submodule，Cloudflare 构建脚本里需 `git submodule update --init --recursive`，本地 clone 也要带 submodule。

---

## 8. 评论：Giscus

曾评估 Valine（LeanCloud），最终改用 [Giscus](https://giscus.app/)（基于 GitHub Discussions）。

### 8.1 前置

1. 仓库 **Public**
2. 开启 **Discussions**
3. 安装 [giscus GitHub App](https://github.com/apps/giscus) 并授权本仓库

### 8.2 本站配置（`hugo.toml`）

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

`repoId` / `categoryId` 是 GitHub GraphQL 公开节点 ID，会出现在页面源码中，**不属于密钥**，可随站点配置公开。

单篇关闭：`comment: false`。  
仅 production 构建加载；本地需 `HUGO_ENV=production`。

评论数据在仓库 Discussions 中管理。

---

## 9. 访问统计：两套分工

| 用途 | 方案 | 说明 |
|------|------|------|
| 站长后台分析 | Cloudflare Web Analytics | 本站域名挂在主域 `leeissonba.com` 下，子域 `blog.*` 流量已出现在同一报表，过滤 Host 即可 |
| 前台展示数字 | [不蒜子](https://busuanzi.ibruce.info/) | 页脚全站 PV/UV + 文章 meta 阅读量 |

Cloudflare Web Analytics **不能**直接把数字渲染到页面上（无公开前台接口）。前台计数按 [Hugo 添加不蒜子（LoveIt）](https://stilig.me/posts/hugo-adds-busuanzi/) 落地：

- `layouts/_partials/plugin/busuanzi.html`
- `layouts/_partials/footer.html`（全站）
- `layouts/posts/single.html`（单页）
- `[params.busuanzi]` 开关与文案前缀

实现时注意：

- 脚本**只在 footer 加载一次**，避免重复计数
- 使用官方 container id：`busuanzi_container_site_pv` 等
- `site_pv` 的前缀用 `site_pv_pre`（原文示例曾误写成 `page_pv_pre`）

---

## 10. 配置开关速查

```toml
# 评论
[params.page.comment]
  enable = true

# 不蒜子
[params.busuanzi]
  enable = true

# 首页社交图标
[params.home.profile]
  social = true
```

主题相关覆盖一律放在项目 `layouts/`、`assets/`，升级 LoveIt submodule 时冲突面更小。

---

## 11. 复现检查清单

从零对齐本站时，建议按序确认：

1. [ ] Hugo Extended + `git submodule update --init`
2. [ ] `hugo.toml`：`baseURL`、默认语言、社交、Giscus、不蒜子
3. [ ] Cloudflare 项目名与 `wrangler.jsonc` 的 `name` 一致
4. [ ] `layouts/` 弃用 API 覆盖 + busuanzi / footer / posts/single
5. [ ] `assets/css/_custom.scss` 代码与视频样式
6. [ ] Cloudflare：连接仓库、构建脚本、自定义域名、`HUGO_ENV=production`
7. [ ] Giscus App 已安装；Discussions 已开
8. [ ] （可选）Web Analytics 过滤 `blog.` 子域
9. [ ] 发布用 Cursor skills：`hugo-blog-publish` + `loveit-theme`
10. [ ] 试发一篇：中英文、`featuredImage`、本地媒体路径、`<!--more-->`

---

## 12. 参考资料

- [LoveIt 主题文档](https://hugoloveit.com)
- [Host on Cloudflare（Hugo）](https://gohugo.io/host-and-deploy/host-on-cloudflare/)
- [Giscus](https://giscus.app/)
- [不蒜子](https://busuanzi.ibruce.info/)
- [Hugo 添加访问统计功能（LoveIt + 不蒜子）](https://stilig.me/posts/hugo-adds-busuanzi/)
- Cloudflare Dashboard → Analytics & Logs → Web Analytics
