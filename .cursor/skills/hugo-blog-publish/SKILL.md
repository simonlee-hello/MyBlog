---
name: hugo-blog-publish
description: 为 Hugo LoveIt 博客填充 front matter、发布中文文章、自动补齐英文版（.en.md），并默认 git commit + push 到 GitHub。用户说「本地测试」时跳过推送。适用于「填充属性」「发布文章」「补齐英文」等场景。默认博客 /Users/simon/Documents/MyWebSite/MyBlog。
---

# Hugo 博客发布 Skill

## 目标

用户**只写中文正文**（Markdown），Agent 负责：

1. 解析源文件（Obsidian / Typora / drafts 任意路径）
2. **生成或补全** Hugo front matter（中文版）
3. 写入 `content/posts/{slug}.md`
4. **自动翻译并补齐** `content/posts/{slug}.en.md`（默认开启）
5. 处理图片路径与 `<!--more-->`
6. `hugo build` 验证
7. **`git commit` + `git push`**（默认执行，触发 Cloudflare 部署）
8. 返回预览 URL

详细英文翻译规则见 [reference-en.md](reference-en.md)。

## 博客约定

| 项 | 值 |
|----|-----|
| 项目根 | `/Users/simon/Documents/MyWebSite/MyBlog` |
| 文章目录 | `content/posts/` |
| Git 远程 | `origin` → `https://github.com/simonlee-hello/MyBlog.git` |
| 默认分支 | `main` |
| 本地草稿目录 | `drafts/` |
| 中文 | `posts/{slug}.md` 或 `posts/{slug}/index.md` |
| 英文 | `posts/{slug}.en.md` 或 `posts/{slug}/index.en.md` |
| 主题 | LoveIt |

## 触发词

- 填充属性 / 补全 front matter / 发布文章 / 导入博客
- **补齐英文 / 同步英文版 / 翻译英文 / 生成 en 版**
- Obsidian 或 Typora 文章发布到 Hugo

**跳过规则：**

| 用户说 | 跳过 |
|--------|------|
| 「仅中文」「不要英文」 | 步骤 4（英文版） |
| 「本地测试」「不要推送」「别 push」 | 步骤 7（Git） |

## 工作流程

### 1. 定位源文件

1. 用户给出的路径
2. `drafts/` 下指定文件
3. Obsidian 默认：`/Users/simon/Documents/ObsidianVault/obsidian-note/Blog/`

### 2. 解析元数据（中文）

| 来源 | 映射 |
|------|------|
| YAML front matter | 直接保留 |
| Obsidian Properties | `title` `date` `tags` `categories` `description` `draft` `slug` |
| 正文 `# 标题` | `title` |
| 正文 `#tag` | `tags` |
| 文件名 | `slug`（kebab-case 英文） |

### 3. 自动填充 front matter（中文）

```yaml
---
title: ""
date: ""           # +08:00
draft: true        # 用户说「发布」时 false
description: ""    # 首段，≤120 字
categories: []     # 默认「随笔」，见 reference-en.md 映射
tags: []
---
```

**slug**：只用 `[a-z0-9-]`，纯中文标题时生成英文语义 slug。

### 4. 正文处理（中文）

- 清理 Obsidian 语法（`![[wiki]]` → 标准 Markdown）
- 无 `<!--more-->` 时在第一段后插入
- 本地图片 → 复制到 `static/images/posts/{slug}/` 或 Page Bundle 同目录，重写路径

### 5. 写入中文版

写入 `content/posts/{slug}.md`（禁止 `.zh-cn.md` 后缀）。

### 6. 自动补齐英文版

读取刚写入的中文文件，生成 `{slug}.en.md`：

1. **front matter**：`date`、`draft`、`tags` 与中文一致；`title`、`description`、`categories` 按 [reference-en.md](reference-en.md) 翻译
2. **正文**：翻译段落/标题/列表；保留代码块、URL、图片路径、shortcode、`<!--more-->` 位置
3. **已存在 `.en.md`**：中文有更新则同步覆盖英文（除非用户说保留旧英文）

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

仅 stage 本次发布相关文件（`content/posts/`、图片、`static/images/posts/` 等），不要提交无关改动。

```bash
git add content/posts/{slug}.md content/posts/{slug}.en.md
# 如有图片：git add static/images/posts/{slug}/ 等
git commit -m "$(cat <<'EOF'
feat(posts): 发布《{中文标题}》

- 新增/更新 {slug} 中英文版本
EOF
)"
git push origin main
git status
```

- push 成功后告知：GitHub 已更新，Cloudflare 将自动重新部署
- push 失败：报告错误，不要重复 force push

## 用户交互

| 情况 | 行为 |
|------|------|
| 默认发布 | 中文 + 英文 + build + **commit + push** |
| 「本地测试」 | 中文 + 英文 + build，**不** git |
| 「仅中文」 | 只写 `.md`，仍默认 push |
| 「只补英文不改中文」 | 只更新 `.en.md`，仍默认 push |
| 未给 slug | 生成后告知 |
| slug 已存在 | 询问覆盖或更新 |

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

1. 读取草稿 → 写入中英文 posts
2. `hugo build` 验证
3. `git commit` + `git push origin main`
4. 返回：`/hugo-tips/`、`/en/hugo-tips/`、GitHub 提交 hash

**用户**：把 `drafts/hugo-tips.md` 本地测试一下

**Agent**：

1. 同上，但 `draft: true`（除非用户说发布）
2. `hugo build` 验证
3. **跳过 git**
4. 返回本地预览地址

## 不要做的事

- 不要修改 `hugo.toml` / 主题文件（除非用户明确要求）
- 不要 `git push --force`
- 不要提交 `.env`、密钥、`public/`、`resources/`
- 不要覆盖已发布英文版而不告知用户
- 不要翻译代码块内容
- 不要为中英文使用不同图片路径
