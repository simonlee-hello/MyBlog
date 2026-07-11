---
name: hugo-blog-publish
description: 为 Hugo LoveIt 博客文章填充 front matter 并发布到 content/posts/。适用于用户在 Typora/Obsidian 写好正文后，要求「填充属性」「补全 front matter」「发布文章」「导入到博客」等场景。默认博客路径 /Users/simon/Documents/MyWebSite/MyBlog，默认语言 zh-cn。
---

# Hugo 博客发布 Skill

## 目标

用户**只写正文**（Markdown），Agent 负责：

1. 解析源文件（Obsidian / Typora / drafts 任意路径）
2. **生成或补全** Hugo front matter
3. 写入 `content/posts/`
4. `hugo build` 验证
5. 按需 `git commit`（仅用户明确要求时）

## 博客约定

| 项 | 值 |
|----|-----|
| 项目根 | `/Users/simon/Documents/MyWebSite/MyBlog` |
| 文章目录 | `content/posts/` |
| 本地草稿目录 | `drafts/`（可选，非必须） |
| 默认语言 | `zh-cn` → `posts/slug.md` |
| 英文版 | `posts/slug.en.md` |
| 主题 | LoveIt |

## 触发词

- 填充属性 / 补全 front matter / 发布文章 / 导入博客
- Obsidian 或 Typora 文章发布到 Hugo

## 工作流程

### 1. 定位源文件

按优先级：

1. 用户给出的绝对/相对路径
2. `drafts/` 下用户指定的文件名
3. Obsidian 默认草稿：`/Users/simon/Documents/ObsidianVault/obsidian-note/Blog/`（用户可覆盖）

源文件可以**没有** front matter，或只有 Obsidian Properties。

### 2. 解析已有元数据

合并以下来源（后者不覆盖已有明确值）：

| 来源 | 映射 |
|------|------|
| 已有 YAML front matter | 直接保留 |
| Obsidian Properties | `title` `date` `tags` `categories` `description` `draft` `slug` |
| 正文首行 `# 标题` | `title` |
| 正文 `#tag`（非标题） | `tags` |
| 文件名 | `slug`（kebab-case，英文） |

### 3. 自动填充规则

```yaml
---
title: ""          # 首行 H1 > Properties > 文件名转标题
date: ""           # Properties > 文件修改时间 > 当前时间（+08:00）
draft: true        # 默认 true；用户说「发布」时改 false
description: ""  # 首段纯文本，截断 120 字
categories: []     # Properties > 推断（见下）> 默认 ["随笔"]
tags: []           # Properties + 正文 #tag，去重，小写
slug: ""           # 文件名 kebab-case；中文标题需转拼音或用户指定英文 slug
---
```

**categories 推断**（取第一个匹配）：

- 安全/渗透/漏洞 → `安全`
- Hugo/前端/编程/代码 → `技术`
- 否则 → `随笔`

**slug 规则**：

- 只用 `[a-z0-9-]`
- 用户未指定时：从英文 title 生成；纯中文 title 用简短英文语义 slug（如 `my-first-post`），**不要**用中文做文件名

### 4. 正文处理

- 移除 Obsidian 专属语法（`![[wiki]]`、`%% comment %%`）或转为 Hugo 兼容格式
- 若无 `<!--more-->`：在第一段后插入
- 图片：
  - `![](本地路径)` → 复制到 `static/images/posts/{slug}/` 并改写为 `/images/posts/{slug}/xxx.png`
  - 外链图片保留

### 5. 写入目标

| 语言 | 路径 |
|------|------|
| 中文 | `content/posts/{slug}.md` |
| 英文 | `content/posts/{slug}.en.md`（仅用户提供英文稿或明确要求双语时） |

**禁止**使用 `.zh-cn.md` 后缀（默认语言用无后缀 `.md`）。

### 6. 验证

```bash
cd /Users/simon/Documents/MyWebSite/MyBlog
hugo build --minify --destination /tmp/hugo-blog-check
```

失败则修复后重试，不要提交。

### 7. Git（可选）

仅用户明确说「提交」「commit」「push」时执行。commit 格式：

```
feat(posts): 发布《{title}》

- 新增文章 {slug}
```

## 用户交互

| 情况 | 行为 |
|------|------|
| 未给 slug | 生成后告知用户，可修改 |
| categories/tags 不确定 | 给出推断值，一行确认 |
| 纯中文无英文版 | 只写 `.md`，不创建 `.en.md` |
| 用户说「发布」 | `draft: false` + build 验证 |

## 快速命令

```bash
# 辅助脚本（可选）
python3 scripts/fill-frontmatter.py drafts/my-article.md --slug my-article

# 预览不写入
python3 scripts/fill-frontmatter.py drafts/my-article.md --dry-run
```

## 示例

**用户**：帮我把 `drafts/hugo-tips.md` 填充属性发布

**Agent**：

1. 读取 `drafts/hugo-tips.md`
2. 生成 front matter，`draft: false`
3. 写入 `content/posts/hugo-tips.md`
4. `hugo build` 验证
5. 返回预览 URL：`/hugo-tips/`

**用户**：Obsidian 里 Blog/hugo-tips.md 填充属性，先不要发布

**Agent**：同上，但 `draft: true`，不 git commit。

## 不要做的事

- 不要擅自翻译整篇英文版
- 不要修改 `hugo.toml` / 主题文件
- 不要 `git push` 除非用户明确要求
- 不要覆盖已有已发布文章，除非用户确认
