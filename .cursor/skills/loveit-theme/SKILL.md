---
name: loveit-theme
description: >-
  LoveIt 主题写作与配置技巧：front matter、摘要、配图、扩展 Markdown、内置/扩展 shortcodes、评论（Giscus）等。
  在撰写/改写 Hugo LoveIt 文章、选用 shortcode、调主题参数，或与 hugo-blog-publish 协作时使用。
  官方文档参考 https://hugoloveit.com 。默认博客 /Users/simon/Documents/MyWebSite/MyBlog。
---

# LoveIt 主题技巧

本 skill 提炼自 [LoveIt 官方站](https://hugoloveit.com) 文档，面向本仓库约定。发布流水线见 [hugo-blog-publish](../hugo-blog-publish/SKILL.md)；shortcode 速查见 [reference-shortcodes.md](reference-shortcodes.md)。

## 何时读取

- 写文章要用 admonition / image / bilibili / mermaid / math 等
- 调整 front matter（配图、TOC、评论、灯箱）
- 排查主题相关渲染/评论问题
- `hugo-blog-publish` 需要把普通 Markdown 升级为 LoveIt 写法时

## 本站约定（优先于通用文档）

| 项 | 值 |
|----|-----|
| 项目根 | `/Users/simon/Documents/MyWebSite/MyBlog` |
| 默认语言 | `zh-cn`（`posts/{slug}.md`） |
| 英文 | `posts/{slug}.en.md` |
| 配图 | `static/images/posts/{slug}/featured.jpg` + front matter `featuredImage` |
| 视频 | `static/videos/posts/{slug}/` 或 `bilibili` shortcode |
| 评论 | Giscus（`params.page.comment.giscus`），仅 **production** 环境加载 |
| 前台计数 | 不蒜子（`params.busuanzi`）：页脚全站 PV/UV + 文章阅读量 |
| 自定义样式 | `assets/css/_custom.scss`（勿改 themes/LoveIt） |
| 主题覆盖 | 项目 `layouts/` 覆盖主题 partial（已修 Hugo 弃用 API） |

## 内容组织

三种本地资源引用（优先级从上到下）：

1. **Page Bundle**：`content/posts/{slug}/index.md` + 同目录资源
2. **assets/**
3. **static/**（本站发布流程默认用这个）

单文件模式 `posts/{slug}.md` 时，配图/正文媒体走 `static/`，路径用站点根路径（如 `/images/posts/...`）。

## Front Matter 常用字段

不必每篇全写；与 `hugo.toml` 的 `[params.page]` 不一致时才覆盖。

```yaml
---
title: ""
subtitle: ""
date: 2026-07-12T12:00:00+08:00
lastmod: 2026-07-12T12:00:00+08:00
draft: false
description: ""
tags: []
categories: []
featuredImage: "/images/posts/{slug}/featured.jpg"
featuredImagePreview: "/images/posts/{slug}/featured.jpg"
hiddenFromHomePage: false
lightgallery: true          # 正文图可点开画廊
toc:
  enable: true
  auto: true
math:
  enable: false             # 公式文章设 true
comment:
  enable: true              # 单篇关闭评论：false
---
```

**配图两种写法（二选一）：**

- 单文件：`featuredImage` / `featuredImagePreview`（本站默认）
- Page Bundle：`resources` 里 `name: featured-image` / `featured-image-preview`，可省略上述字段

## 摘要（首页预览）

优先级：

1. `<!--more-->` 前为空 → 用 `description`
2. `<!--more-->` 前有内容 → 用该段
3. front matter `summary`
4. Hugo 自动截断（CJK 需 `hasCJKLanguage = true`，本站已开）

**发布约定**：第一段后插入 `<!--more-->`；摘要不要含代码块/大图/表格。

## 写作技巧（高频）

### 提示横幅

```markdown
{{< admonition tip "标题" >}}
内容支持 **Markdown**。
{{< /admonition >}}
```

类型：`note` `abstract` `info` `todo` `tip` `success` `question` `warning` `failure` `danger` `bug` `example` `quote`。第三参数 `false` 可默认折叠。

### 图片（推荐 shortcode）

比裸 `![]()` 更好：懒加载 + lightGallery。

```markdown
{{< image src="/images/posts/{slug}/shot.png" caption="说明" >}}
```

需灯箱时 front matter 设 `lightgallery: true`（或站点默认开启）。

### Bilibili

```markdown
{{< bilibili BV1Sx411T7QQ >}}
{{< bilibili id=BV1TJ411C7An p=3 >}}
```

### 本地视频

```html
<video controls playsinline preload="metadata" src="/videos/posts/{slug}/demo.mp4"></video>
```

宽度由 `_custom.scss` 约束为内容区 100%。

### 代码

- 长行：依赖本站 `pre-wrap` 自定义样式；仍建议在源码里适度断行
- 需要指定语言高亮用 fenced code 或 `highlight` shortcode

### 公式

站点 `[params.page.math] enable = false`。单篇开启：

```yaml
math:
  enable: true
```

Markdown 里 `\(` `\[` 等易被 Hugo 吃掉时，用 `raw` shortcode 包公式。详见 reference。

### 扩展语法（本站已开 ruby / fraction / fontawesome）

| 写法 | 效果 |
|------|------|
| `[Hugo]^(静态站点生成器)` | 注音/注释 |
| `[99]/[100]` | 分数 |
| `:(fas fa-campground):` | Font Awesome 图标 |

### 图表

- 围栏 ` ```mermaid ` / ` ```goat `
- 或 `{{< mermaid >}}` … `{{< /mermaid >}}`

## 评论（Giscus）

配置在 `hugo.toml` → `[params.page.comment.giscus]`。本站当前值：

| 项 | 值 |
|----|-----|
| repo | `simonlee-hello/MyBlog` |
| repoId | `R_kgDOTVNnWg` |
| category | `Announcements` |
| categoryId | `DIC_kwDOTVNnWs4DBC6N` |
| mapping | `pathname` |

要点：

1. 仓库须为 Public，并开启 Discussions
2. 安装 [giscus GitHub App](https://github.com/apps/giscus) 并授权本仓库，否则无法发评论
3. LoveIt **仅在 `hugo.Environment == production` 时加载评论**；本地用 `HUGO_ENV=production hugo server` 验证
4. 单篇关闭：`comment: false`
5. 评论数据在 GitHub Discussions 中管理

## 前台计数（不蒜子）

配置 `[params.busuanzi]`。实现参考 [stilig 文章](https://stilig.me/posts/hugo-adds-busuanzi/)：

| 位置 | 内容 |
|------|------|
| 页脚 | 全站 PV / UV（`site_pv` / `site_uv`） |
| 文章 meta | 本文阅读量（`page_pv`） |

模板：`layouts/_partials/plugin/busuanzi.html`，脚本只在 footer 加载一次。  
与 Cloudflare Web Analytics（站长后台）互补，不互相替代。

## 与 hugo-blog-publish 的分工

| 职责 | Skill |
|------|--------|
| 草稿 → front matter、配图、中英翻译、commit/push | `hugo-blog-publish` |
| 正文里怎么用 LoveIt shortcode / 扩展语法 / 主题参数 | **本 skill** |

发布时若正文适合用 shortcode，Agent 应主动改写（例如重要提示 → `admonition`，B 站链接 → `bilibili`，需灯箱的图 → `image`），并保持中英文 shortcode 结构一致。

## 不要做的事

- 不要直接改 `themes/LoveIt`（用项目 `layouts/`、`assets/`、`hugo.toml`）
- 不要在摘要里塞 shortcode 富块
- 不要假设本地 dev 能看到评论（需 production）
- 不要把 GitHub token / Master Key 之类密钥写进仓库（Giscus 的 repoId/categoryId 可公开）
