# LoveIt Shortcodes 速查

来源：[内置](https://hugoloveit.com/theme-documentation-built-in-shortcodes/) · [扩展](https://hugoloveit.com/theme-documentation-extended-shortcodes/)

文档里写 `{{</* ... */>}}` 是为防渲染；正文应使用正常 `{{< ... >}}`。

## 扩展 Shortcodes（优先掌握）

### admonition

```markdown
{{< admonition tip "这是一个提示" false >}}
可折叠的 tip；第三参数 `false` = 默认收起。
{{< /admonition >}}
```

类型：`note` `abstract` `info` `todo` `tip` `success` `question` `warning` `failure` `danger` `bug` `example` `quote`

### image

```markdown
{{< image src="/images/posts/slug/a.png" caption="说明" title="悬停标题" >}}
```

常用参数：`src` `alt` `caption` `title` `width` `height` `src_s` `src_l` `linked`

配合 front matter `lightgallery: true`。

### bilibili

```markdown
{{< bilibili BV1Sx411T7QQ >}}
{{< bilibili id=BV1TJ411C7An p=3 >}}
```

### style（需 Hugo Extended）

```markdown
{{< style "text-align:right; strong{color:#00b1ff;}" >}}
右对齐段落，**强调**可变色。
{{< /style >}}
```

### link

```markdown
{{< link "https://example.com" "示例" "悬停说明" >}}
```

### mermaid / echarts / mapbox / music / typeit

```markdown
{{< mermaid >}}
graph TD
  A --> B
{{< /mermaid >}}
```

完整参数见官方对应子文档；本站一般够用围栏代码块 ` ```mermaid `。

### script / raw / person

```markdown
{{< script >}}
console.log('Hello LoveIt!');
{{< /script >}}

{{< raw >}}\(E=mc^2\){{< /raw >}}

{{< person "https://dillonzq.com/" Dillon "LoveIt 作者" >}}
```

`raw`：避免 Hugo 转义数学公式或需原样输出的片段。  
`script`：保证在第三方库加载后再执行。

## 内置 Shortcodes（按需）

| Shortcode | 用途 |
|-----------|------|
| `figure` | 带说明的图（更推荐扩展 `image`） |
| `gist` | GitHub Gist |
| `highlight` | 代码高亮 |
| `youtube` / `vimeo` | 视频嵌入 |
| `instagram` | Instagram |
| `twitter` / `x` | 推文（视 Hugo 版本） |
| `param` | 输出 front matter 字段 |
| `ref` / `relref` | 站内链接 |
| `permalinks` 相关 | 见 Hugo 官方 |

示例：

```markdown
{{< youtube w7Ft2ymGmfc >}}
{{< highlight go >}}
fmt.Println("hi")
{{< /highlight >}}
{{< ref "posts/my-first-post.md" >}}
```

## 扩展 Markdown（非 shortcode）

本站 `hugo.toml` 已开 `ruby` / `fraction` / `fontawesome`：

```markdown
[Hugo]^(静态站点生成器)
[99]/[100]
去露营 :(fas fa-campground):
```

Emoji：可用原生 Unicode，或见 [Emoji Support](https://hugoloveit.com/emoji-support/)。

## 公式转义备忘

开启 `math.enable` 后，若分隔符被 Hugo 吃掉：

- 优先用 `{{< raw >}}...{{< /raw >}}`
- 或手动转义：`_`→`\_`，`\(`→`\\(` 等（见官方 Content 文档）

## 本站发布时的改写建议

| 原文形态 | 建议 |
|----------|------|
| 「注意/提示」段落 | `admonition` |
| 需要灯箱的配图 | `image` + `lightgallery: true` |
| Bilibili URL | `bilibili` |
| YouTube URL | `youtube` |
| 本地 mp4 | `<video controls …>` |
| 架构/流程说明 | `mermaid` 围栏或 shortcode |
| 重要外链需 title | `link` |
