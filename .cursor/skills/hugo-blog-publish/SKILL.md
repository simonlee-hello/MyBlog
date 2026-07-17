---
name: hugo-blog-publish
description: 为 Hugo LoveIt 博客填充 front matter、发布中文文章、自动补齐英文版（.en.md），并默认 git commit + push 到 GitHub。用户说「本地测试」时跳过推送。适用于「填充属性」「发布文章」「补齐英文」等场景。LoveIt shortcode/主题技巧见 loveit-theme skill。默认博客 /Users/simon/Documents/MyWebSite/MyBlog。
---

# Hugo 博客发布 Skill

## 目标

用户**只写中文正文**（Markdown），Agent 负责：

1. 解析源文件（Obsidian / Typora / drafts 任意路径）
2. **生成或补全** Hugo front matter（中文版）
3. **生成/配置文章配图（featuredImage）**
4. 写入 `content/posts/{slug}.md`
5. **自动翻译并补齐** `content/posts/{slug}.en.md`（默认开启）
6. 处理正文图片/视频路径与 `<!--more-->`
7. **按 LoveIt 技巧改写正文**（见下节「LoveIt 协作」）
8. `hugo build` 验证
9. `git commit` **+** `git push`（默认执行，触发 Cloudflare 部署）
10. 返回预览 URL, 并验证是否成功发布
11. 若源文件来自 `drafts/`：**发布成功后删除该草稿**（及同目录配套媒体，见步骤 9.1）

详细英文翻译规则见 [reference-en.md](reference-en.md)。  
主题用法 / shortcode / 评论等见 **[loveit-theme](../loveit-theme/SKILL.md)**（速查 [reference-shortcodes.md](../loveit-theme/reference-shortcodes.md)）。

## 博客约定


| 项      | 值                                                         |
| ------ | --------------------------------------------------------- |
| 项目根    | `/Users/simon/Documents/MyWebSite/MyBlog`                 |
| 文章目录   | `content/posts/`                                          |
| Git 远程 | `origin` → `https://github.com/simonlee-hello/MyBlog.git` |
| 默认分支   | `main`                                                    |
| 本地草稿目录 | `drafts/`                                                 |
| 中文     | `posts/{slug}.md` 或 `posts/{slug}/index.md`               |
| 英文     | `posts/{slug}.en.md` 或 `posts/{slug}/index.en.md`         |
| 主题     | LoveIt（技巧 → [loveit-theme](../loveit-theme/SKILL.md)） |
| 评论     | Giscus（站点级开启；单篇可用 `comment: false` 关闭） |


## LoveIt 协作

发布正文时**读取 loveit-theme**，在不改变原意的前提下做轻量升级：

| 场景 | 处理 |
|------|------|
| 注意/提示/警告段落 | `admonition` |
| Bilibili 链接 | `bilibili` shortcode |
| 需灯箱的图 | `image` shortcode，必要时 `lightgallery: true` |
| 流程/架构图 | `mermaid` |
| 本地视频 | `<video controls playsinline …>` |
| 公式文 | 单篇 `math.enable: true`，必要时 `raw` |
| 冗长/宣传腔正文 | 按 loveit-theme「正文风格：干货优先」精简 |

中英文 shortcode **结构保持一致**（只翻译 shortcode 内可见文案，如 admonition 标题/正文）。写作默认遵循 loveit-theme 的干货优先准则。

## 触发词

- 填充属性 / 补全 front matter / 发布文章 / 导入博客
- **补齐英文 / 同步英文版 / 翻译英文 / 生成 en 版**
- Obsidian 或 Typora 文章发布到 Hugo

**跳过规则：**


| 用户说                  | 跳过            |
| -------------------- | ------------- |
| 「仅中文」「不要英文」          | 步骤 5（英文版）     |
| 「本地测试」「不要推送」「别 push」 | 步骤 9（Git）     |




## 工作流程



### 1. 定位源文件

1. 用户给出的路径
2. `drafts/` 下指定文件
3. Obsidian 默认：`/Users/simon/Documents/ObsidianVault/obsidian-note/Blog/`



### 2. 解析元数据（中文）


| 来源                  | 映射                                                              |
| ------------------- | --------------------------------------------------------------- |
| YAML front matter   | 直接保留                                                            |
| Obsidian Properties | `title` `date` `tags` `categories` `description` `draft` `slug` |
| 正文 `# 标题`           | `title`                                                         |
| 正文 `#tag`           | `tags`                                                          |
| 文件名                 | `slug`（kebab-case 英文）                                           |




### 3. 自动填充 front matter（中文）

```yaml
---
title: ""
date: ""           # +08:00
draft: true        # 用户说「发布」时 false
description: ""    # 首段，≤120 字
categories: []     # 默认「随笔」，见 reference-en.md 映射
tags: []
featuredImage: "/images/posts/{slug}/featured.jpg"
featuredImagePreview: "/images/posts/{slug}/featured.jpg"
---
```

**slug**：只用 `[a-z0-9-]`，纯中文标题时生成英文语义 slug。

### 3.1 文章配图（featuredImage，必做）

对齐 [LoveIt 官方站](https://hugoloveit.com) 首页宽幅封面效果。**每次发布都必须配置配图**，除非用户明确说「不要配图」。

| 项 | 约定 |
|----|------|
| 文件 | `static/images/posts/{slug}/featured.jpg`（或 `.png` / `.webp`） |
| front matter | `featuredImage` + `featuredImagePreview`（通常指向同一文件） |
| 中英文 | **共用同一张配图路径**，不要为 `.en.md` 另存一份 |
| 比例 | 宽幅横图，优先 **16:9**（LoveIt 列表预览会裁切铺满） |
| 内容 | 与文章主题相关；无水印、无大段文字、无 Logo 墙 |

**来源优先级：**

1. 用户指定的封面图 / 草稿目录下的 `featured.*` / `cover.*`
2. 正文首张合适配图（复制为 `featured.jpg`）
3. Agent 按文章主题生成一张封面并写入上述路径

**Page Bundle 可选写法**（与 LoveIt 文档一致）：

```yaml
resources:
- name: "featured-image"
  src: "featured-image.jpg"
- name: "featured-image-preview"
  src: "featured-image-preview.jpg"
```

单文件模式（`posts/{slug}.md`）优先用 `featuredImage` / `featuredImagePreview`。

### 4. 正文处理（中文）

- 清理 Obsidian 语法（`![[wiki]]` → 标准 Markdown）
- 无 `<!--more-->` 时在第一段后插入
- **本地媒体**（与图片规则一致）：

| 类型 | 目标目录 | 正文路径改写 |
|------|----------|--------------|
| 图片（png/jpg/webp/gif/svg） | `static/images/posts/{slug}/` | `/images/posts/{slug}/文件名` |
| 视频（mp4/webm/mov） | `static/videos/posts/{slug}/` | `/videos/posts/{slug}/文件名` |

- Page Bundle（`posts/{slug}/index.md`）时：媒体也可放在同目录，用相对路径引用
- 外链图片/视频 URL、Bilibili/YouTube 嵌入：保留原样，不下载进仓库
- Obsidian `![[foo.png]]` / `![[bar.mp4]]` → 标准 Markdown / HTML 后，再按上表搬迁
- 视频正文推荐：

```html
<video controls src="/videos/posts/{slug}/demo.mp4"></video>
```

或 Markdown：`[demo.mp4](/videos/posts/{slug}/demo.mp4)`



### 5. 写入中文版

写入 `content/posts/{slug}.md`（禁止 `.zh-cn.md` 后缀）。

### 6. 自动补齐英文版

读取刚写入的中文文件，生成 `{slug}.en.md`：

1. **front matter**：`date`、`draft`、`tags`、`featuredImage`、`featuredImagePreview` 与中文一致；`title`、`description`、`categories` 按 [reference-en.md](reference-en.md) 翻译
2. **正文**：翻译段落/标题/列表；保留代码块、URL、图片路径、shortcode、`<!--more-->` 位置
3. **已存在** `.en.md`：中文有更新则同步覆盖英文（除非用户说保留旧英文）



### 7. 验证

```bash
cd /Users/simon/Documents/MyWebSite/MyBlog
hugo build --minify --destination /tmp/hugo-blog-check
```

失败则修复后重试，**不要 commit**。

### 8. Git 提交并推送（默认）

`hugo build` 成功后，除非用户说「本地测试」，否则**必须**执行：

```bash
cd /Users/simon/Documents/MyWebSite/MyBlog
git status
git diff
git log --oneline -3
```

仅 stage 本次发布相关文件（`content/posts/`、媒体等），不要提交无关改动。

```bash
git add content/posts/{slug}.md content/posts/{slug}.en.md
# 如有媒体 / 配图：
# git add static/images/posts/{slug}/
# git add static/videos/posts/{slug}/
git commit -m "$(cat <<'EOF'
feat(posts): 发布《{中文标题}》

- 新增/更新 {slug} 中英文版本
EOF
)"
git push origin main
git status
```

- push 成功后告知：GitHub 已更新，Cloudflare 将自动重新部署
- push 失败：报告错误，不要重复 force push；**不要删除草稿**

### 9.1 清理 drafts 源文件（发布成功后）

**仅当**同时满足：

1. 源文件路径位于项目 `drafts/` 下（含子目录）
2. 本次为正式发布（`draft: false`，且非「本地测试」）
3. `git push` 已成功

则删除草稿，避免重复发布：

```bash
# 删除源 Markdown
rm -f drafts/{源文件名}.md

# 若草稿旁有已搬迁到 static/ 的配套媒体（同篇图片/视频），一并删除
# 仅删本篇相关文件，不要清空整个 drafts/
# rm -f drafts/{相关图片或视频文件名}
```

| 注意 | 说明 |
|------|------|
| `drafts/` 已被 `.gitignore` | 删除只影响本地，无需 git commit |
| 「本地测试」 | **不删**草稿 |
| 源在 Obsidian / 其他路径 | **不删**（只清理 `drafts/`） |
| push 失败 / build 失败 | **不删**，便于重试 |
| 用户说「保留草稿」 | 跳过本步 |



## 用户交互


| 情况         | 行为                                  |
| ---------- | ----------------------------------- |
| 默认发布       | 中文 + 英文 + build + **commit + push**；源在 `drafts/` 则删草稿 |
| 「本地测试」     | 中文 + 英文 + build，**不** git，**不**删草稿 |
| 「仅中文」      | 只写 `.md`，仍默认 push；源在 `drafts/` 则删草稿 |
| 「只补英文不改中文」 | 只更新 `.en.md`，仍默认 push               |
| 「保留草稿」     | 发布后不删除 `drafts/` 源文件                |
| 未给 slug    | 生成后告知                               |
| 「不要配图」 | 跳过 featuredImage 生成，其余照常 |




## 快速命令

```bash
# 仅填充中文 front matter（不翻译，手动场景）
python3 scripts/fill-frontmatter.py drafts/my-article.md --slug my-article

# 预览
python3 scripts/fill-frontmatter.py drafts/my-article.md --dry-run
```

英文版由 Agent 翻译生成，不依赖脚本机翻。

## 示例

**用户**：把 `drafts/hugo-tips.md` 填充属性并发布

**Agent**：

1. 读取草稿 → 写入中英文 posts（含 featuredImage）
2. 配图写入 `static/images/posts/{slug}/featured.jpg`
3. `hugo build` 验证（首页可见宽幅封面）
4. `git commit` + `git push origin main`
5. **删除** `drafts/hugo-tips.md`（及本篇已搬迁的配套媒体）
6. 返回：`/{slug}/`、`/en/{slug}/`、GitHub 提交 hash；告知草稿已清理

**用户**：把 `drafts/hugo-tips.md` 本地测试一下

**Agent**：

1. 同上，但 `draft: true`（除非用户说发布）
2. `hugo build` 验证
3. **跳过 git**
4. **保留** `drafts/hugo-tips.md`
5. 返回本地预览地址



## 不要做的事

- 不要修改 `hugo.toml` / 主题文件（除非用户明确要求）
- 不要 `git push --force`
- 不要提交 `.env`、密钥、`public/`、`resources/`
- 不要覆盖已发布英文版而不告知用户
- 不要翻译代码块内容
- 不要为中英文使用不同图片/视频路径
- 不要把外链视频下载进仓库（除非用户明确要求）
- 不要发布无配图文章（除非用户明确说「不要配图」）
- 不要在「本地测试」或 push/build 失败时删除 `drafts/` 草稿
- 不要删除 Obsidian 等非 `drafts/` 路径的源文件
- 不要清空整个 `drafts/` 目录（只删本篇相关文件）

