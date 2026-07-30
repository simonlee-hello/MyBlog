# Web Analytics（Cloudflare Worker + D1）

基于 [analytics_with_cloudflare](https://github.com/yestool/analytics_with_cloudflare)，扩展全站 `spv` / `suv`。

## 部署

```bash
cd services/web-analytics
npm install
npx wrangler login
npx wrangler d1 create web_analytics
# 将输出的 database_id 写入 wrangler.jsonc
npm run initSql
npm run deploy
```

> 须使用本目录的 `wrangler.jsonc`（脚本已加 `--config`）。勿用仓库根目录的 `wrangler.jsonc`（那是 Hugo 静态站 `simons-blog`）。

Cloudflare Dashboard → Workers → `web-analytics` → 自定义域：`analytics.leeissonba.com`。

确认博客 [`hugo.toml`](../../hugo.toml) 中 `[params.webAnalytics].baseURL` 与该域名一致。

## API

`POST /api/visit`

请求体字段：`hostname`、`url`、`referrer`，以及可选布尔标记 `pv` / `uv` / `spv` / `suv`。

返回：`{ ret: "OK", data: { pv?, uv?, spv?, suv? } }`

`POST /api/pv`（只读，不写入）

请求体：`{ hostname, paths: string[] }`（最多 50 条）。

返回：`{ ret: "OK", data: { "/path/": 12, ... } }`
