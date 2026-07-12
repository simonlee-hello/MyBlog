# Simon's Blog

基于 [Hugo](https://gohugo.io/) 和 [LoveIt](https://github.com/dillonzq/LoveIt) 主题搭建的个人博客。

## 技术栈

- Hugo (Extended)
- LoveIt 主题（Git Submodule）
- 中英文双语支持

## 项目结构

```
.
├── archetypes/     # 文章模板
├── assets/         # 自定义样式（覆盖主题）
├── content/        # 博客内容
├── static/         # 静态资源（图片、favicon 等）
├── themes/LoveIt/  # 主题（submodule）
└── hugo.toml       # 站点配置
```

## 本地开发

```bash
# 启动开发服务器（含草稿）
make dev

# 或直接运行
hugo server -D
```

访问 http://localhost:1313

## 构建

```bash
make build

# 输出目录：public/
```

## 新建文章

```bash
hugo new posts/my-new-post.md
```

## 评论系统（Giscus）

本站使用 [Giscus](https://giscus.app/)（基于 GitHub Discussions）。配置在 `hugo.toml` 的 `[params.page.comment.giscus]`。

前置条件：

1. 仓库为 **Public**，并已开启 **Discussions**
2. 安装 [giscus GitHub App](https://github.com/apps/giscus)，授权给 `simonlee-hello/MyBlog`
3. 评论仅在 **production** 构建中加载（Cloudflare 部署已设 `HUGO_ENV=production`）

单篇关闭评论：front matter 写 `comment: false`。

## 部署到 Cloudflare Workers

参考 [Hugo 官方文档](https://gohugo.io/host-and-deploy/host-on-cloudflare/)，本项目已包含：

| 文件 | 作用 |
|------|------|
| `wrangler.jsonc` | Cloudflare Workers 配置 |
| `build.sh` | 云端构建脚本（Hugo Extended + 主题 submodule） |
| `package.json` | 启用 Cloudflare 构建缓存 |

### 首次部署步骤

1. 将仓库推送到 GitHub（需包含 `themes/LoveIt` submodule）
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Add** → **Workers**
3. **Connect GitHub**，选择本仓库
4. 设置应用：
   - **Project name**: `simons-blog`（或与 `wrangler.jsonc` 中 `name` 一致）
   - **Build command**: 留空
   - **Deploy command**: `npx wrangler deploy`
   - **Advanced** → **构建**环境变量（不是「变量和密钥」）：
     - `SKIP_DEPENDENCY_INSTALL` = `true`
     - `HUGO_BASEURL` = `https://blog.你的域名.com`（可选，见下方说明）
5. 点击 **Deploy**，完成后访问站点

> **注意**：纯静态 Worker **不能**在「Settings → Variables and Secrets（变量和密钥）」里加变量，那里是运行时用的。`HUGO_BASEURL` 要么在 **Settings → Build → Build variables（构建变量）** 里填，要么直接写进 `hugo.toml`（推荐）。

### 自定义域名

1. Cloudflare → **Workers & Pages** → 项目 **simons-blog**
2. **Settings → Domains & Routes** → **Add** → **Custom Domain**
3. 输入例如 `blog.你的域名.com`（域名已在 Cloudflare 时会自动配 DNS）
4. 把 `hugo.toml` 里的 `baseURL` 改成同一地址：

```toml
baseURL = "https://blog.你的域名.com/"
```

5. 提交并 push，触发重新部署

**HUGO_BASEURL 填什么？** 填用户浏览器里访问博客的完整地址，例如：

| 访问方式 | baseURL |
|----------|---------|
| 自定义域名 | `https://blog.example.com/` |
| 临时 Workers 域名 | `https://simons-blog.xxxxx.workers.dev/` |

**推荐做法**：直接改 `hugo.toml` 的 `baseURL`，不依赖 Cloudflare 环境变量，最简单。

### 构建缓存（可选）

Dashboard → 项目 → **Settings → Build → Build cache** → **Enable**

## 部署前检查

1. 在 `hugo.toml` 中将 `baseURL` 改为实际域名
2. 确认 `static/images/avatar.png` 等静态资源已就位
3. 运行 `make build` 检查构建是否成功

## 许可证

内容版权归作者所有。
