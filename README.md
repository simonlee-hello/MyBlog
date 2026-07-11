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
   - **Advanced** → 环境变量：
     - `SKIP_DEPENDENCY_INSTALL` = `true`
     - `HUGO_BASEURL` = `https://simons-blog.<你的子域>.workers.dev`（部署后按实际 URL 填写）
5. 点击 **Deploy**，完成后访问站点

### 自定义域名

在 Cloudflare Workers 项目 **Settings → Domains & Routes** 绑定域名后，同步更新 `hugo.toml` 的 `baseURL` 或 Cloudflare 环境变量 `HUGO_BASEURL`。

### 构建缓存（可选）

Dashboard → 项目 → **Settings → Build → Build cache** → **Enable**

## 部署前检查

1. 在 `hugo.toml` 中将 `baseURL` 改为实际域名
2. 确认 `static/images/avatar.png` 等静态资源已就位
3. 运行 `make build` 检查构建是否成功

## 许可证

内容版权归作者所有。
