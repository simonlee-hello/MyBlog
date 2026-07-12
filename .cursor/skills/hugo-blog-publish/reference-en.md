# 英文版补齐参考

## 触发

用户写中文文章并要求发布/填充属性时，**默认同时生成或更新** `{slug}.en.md`，除非用户明确说「仅中文」「不要英文」。

单独触发词：补齐英文 / 同步英文版 / 翻译英文 / translate en

## 文件配对

| 中文 | 英文 |
|------|------|
| `content/posts/{slug}.md` | `content/posts/{slug}.en.md` |
| `content/posts/{slug}/index.md` | `content/posts/{slug}/index.en.md` |

Page Bundle 与单文件模式均遵循：`index.md` ↔ `index.en.md`。

## front matter 对齐规则

| 字段 | 中文 | 英文 |
|------|------|------|
| `date` | 相同 | 相同 |
| `draft` | 相同 | 相同 |
| `title` | 中文标题 | 自然英文标题 |
| `description` | 中文摘要 | 英文摘要（非字面机翻腔） |
| `tags` | 技术词保留英文：`hugo`, `loveit` | 与中文版一致（技术 tag 不翻译） |
| `categories` | 见下表 | 见下表 |

### categories 映射

| 中文 | 英文 |
|------|------|
| 博客 | blog |
| 技术 | tech |
| 安全 | security |
| 随笔 | notes |

## 正文翻译规则

1. **保留不变**：代码块、行内代码、URL、图片路径、`<!--more-->` 位置、Hugo shortcode、HTML 注释
2. **翻译**：段落、列表、标题（H2+）、blockquote、表格文字、图片 alt/caption
3. **不翻译**：专有名词（Hugo、LoveIt、Cloudflare、API）、已英文的 tag
4. **语气**：技术博客风格，简洁准确，避免过度意译
5. **结构**：段落数、列表层级与中文版一致

## 媒体（图片 / 视频）

- 两语言**共用相同媒体路径**，不要为英文版再复制一份
- 路径约定：

| 类型 | static 目录 | URL |
|------|-------------|-----|
| 图片 | `static/images/posts/{slug}/` | `/images/posts/{slug}/...` |
| 视频 | `static/videos/posts/{slug}/` | `/videos/posts/{slug}/...` |

- Page Bundle 内媒体只存一份，英文 `index.en.md` 引用同目录文件
- 翻译时保留图片/视频路径与 `src`；可翻译 alt/caption

## 同步策略

| 场景 | 行为 |
|------|------|
| 新建中文，无 `.en.md` | 创建完整英文版 |
| 中文已更新，英文过时 | 按中文重新翻译并覆盖 `.en.md`（覆盖前告知用户） |
| 英文已存在且用户未要求更新 | 不覆盖，询问是否同步 |
| 仅更新 front matter | 同步翻译 title/description，正文不动 |

## 质量检查

- [ ] `hugo build` 通过
- [ ] 中英文 `date`、`draft`、`tags` 一致
- [ ] `<!--more-->` 两侧段落语义对应
- [ ] 链接在 `/en/` 下可正常访问（站内链使用相对路径或 Hugo 内置链接）
- [ ] 预览路径：`/{slug}/` 与 `/en/{slug}/`
