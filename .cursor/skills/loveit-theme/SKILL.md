---
name: loveit-theme
description: >-
  LoveIt 主题写作与配置技巧：干货优先正文风格、front matter、摘要、配图、扩展 Markdown、内置/扩展 shortcodes、评论（Giscus）等。
  在撰写/改写/精简 Hugo LoveIt 文章、选用 shortcode、调主题参数，或与 hugo-blog-publish 协作时使用。
  官方文档参考 https://hugoloveit.com 。默认博客 /Users/simon/Documents/MyWebSite/MyBlog。
---

# LoveIt 主题技巧

本 skill 提炼自 [LoveIt 官方站](https://hugoloveit.com) 文档，面向本仓库约定。发布流水线见 [hugo-blog-publish](../hugo-blog-publish/SKILL.md)；shortcode 速查见 [reference-shortcodes.md](reference-shortcodes.md)。

## 何时读取

- 写文章 / 改写 / 精简正文（干货优先）
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
| 访问统计 | Cloudflare Web Analytics（站长后台）；前台 PV/UV 已移除 |
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

## 正文风格：干货优先

本站技术文默认**高信息密度**：读者要的是可复用结论、流程、命令与限制，不是氛围渲染或营销腔。

### 要做

- 开篇直接给结论或问题边界；首段即可被 `description` / `<!--more-->` 摘要复用
- 结构优先：原因 → 方案/流程 → 能力要点 → 命令示例 → 限制与检查项
- 用列表、步骤、命令块承载信息；一句能说清就不写一段
- 保留可验证细节：退出码、参数行为、失败模式、时效、合规边界
- 中英文同步时保持同一结构与同一信息量，不额外加英文抒情

### 不要做

- 不要场景化铺垫（「进了内网、权限也稳……」类叙事开场）
- 不要重复同一结论（节首、节中、小结各说一遍）
- 不要夸大或宣传腔（「更稳」「痛点不只是……这么简单」「卡点常常不是……」）
- 不要为「有文采」加无增量句子；删掉后不影响操作与判断的句子应删
- 不要用口号收尾代替检查清单或限制说明

### 改写时

用户要求「去废话 / 干货化 / 精简」时：先删冗余与重复，再压缩句式，最后必要时重排小节；不要为了显得完整而回填空话。

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

### GIF / 演示动图（与正文同宽）

LoveIt 正文 `figure img` **不会**默认拉满栏宽，会按 GIF 像素宽显示。演示类 GIF **必须**加 `width="100%"`：

```markdown
{{< image src="/images/posts/{slug}/demo.gif" caption="说明" width="100%" >}}
```

中英文 shortcode 参数保持一致（含 `width`）。普通静态截图不强制。

### Bilibili

```markdown
{{< bilibili BV1Sx411T7QQ >}}
{{< bilibili id=BV1TJ411C7An p=3 >}}
```

### 本地视频（与正文同宽）

```html
<video controls playsinline preload="metadata" src="/videos/posts/{slug}/demo.mp4"></video>
```

宽度由 `_custom.scss` 约束为内容区 100%；发布时仍须用上述 `<video>` 写法，不要改成仅 Markdown 链接。

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

## 访问统计

站长后台：Cloudflare Web Analytics。前台不蒜子/Vercount 因第三方数据会重置，已移除，勿再接入同类免费计数。

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
- 不要违反上文「正文风格：干货优先」（空话、重复结论、夸大表述）
