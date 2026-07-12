---
title: 'A Survey of AI for Video Generation and Intelligent Editing'
date: '2026-07-12T22:45:00+08:00'
draft: false
description: 'Notes from exploring AI tools for video generation and intelligent editing, including video-use, OpenMontage, Remotion, dots.tts, and HyperFrames.'
categories: ['tech']
tags: ['ai', 'video', 'openmontage', 'video-use']
featuredImage: '/images/posts/ai-video-generation-editing-survey/featured.jpg'
featuredImagePreview: '/images/posts/ai-video-generation-editing-survey/featured.jpg'
---

I recently looked into AI for video generation and intelligent editing. This post records what I learned.

<!--more-->

I mainly tried these open-source tools: video-use, OpenMontage, Remotion, dots.tts, and HyperFrames. Briefly:

| Tool        | Description |
| ----------- | ----------- |
| video-use   | An open-source workflow that uses an AI coding agent to refine existing footage (transcribe → cut points → grade/subtitles/overlays → final cut). |
| OpenMontage | Turns a coding agent into a full video studio: research, scripts, voiceover, and synthesis end to end. |
| Remotion    | An open-source framework for writing programmable videos in React and rendering frame-by-frame to MP4. |
| dots.tts    | A local TTS model open-sourced by Xiaohongshu; generates high-quality speech from text (optional reference audio). |
| HyperFrames | Write browser animation layouts with HTML/CSS/GSAP, then deterministically capture frames into video. |

## Video-USE

> https://github.com/browser-use/video-use

### Installation

Dependencies are relatively easy to set up. You can also ask your agent to install it with a prompt like:

```text
Set up https://github.com/browser-use/video-use for me.

Read install.md first to install this repo, wire up ffmpeg,
register the skill with whichever agent you're running under,
and set up the ElevenLabs API key — ask me to paste it when you need it.
Then read SKILL.md for daily usage, and always read helpers/
because that's where the editing scripts live.
After install, don't transcribe anything on your own —
just tell me it's ready and wait for me to drop footage into a folder.
```

Manual install:

```bash
# 1. Clone and symlink into your agent's skills directory
git clone https://github.com/browser-use/video-use ~/Developer/video-use
ln -sfn ~/Developer/video-use ~/.claude/skills/video-use        # Claude Code
# ln -sfn ~/Developer/video-use ~/.codex/skills/video-use       # Codex

# 2. Install deps
cd ~/Developer/video-use
uv sync                         # or: pip install -e .
brew install ffmpeg             # required
brew install yt-dlp             # optional, for downloading online sources

# 3. Add your ElevenLabs API key
cp .env.example .env
$EDITOR .env                    # ELEVENLABS_API_KEY=...
```

Project layout:

![video-use directory layout](/images/posts/ai-video-generation-editing-survey/image-20260712215207727.png)

### First try

It is mainly audio-first (talking-head style): speech → text, then the model analyzes the transcript, writes an edit script, renders, and delivers. As a skill, you can steer pacing and direction interactively, similar to vibe-coding. The first trials felt promising.

I used cc-switch to manage skills, and Cursor as the agent (any agent works).

![Managing skills with cc-switch](/images/posts/ai-video-generation-editing-survey/image-20260712215338858.png)

This was roughly an 8-minute talking-head source. The tool analyzed the full spoken content and structure, and flagged stumbles / repeats / rambling for later cuts. Editing is driven by ffmpeg; transcription uses ElevenLabs.

![Talking-head analysis and structure](/images/posts/ai-video-generation-editing-survey/image-20260712215633323.png)

It proposes an edit strategy and asks for your input.

![Edit strategy suggestions](/images/posts/ai-video-generation-editing-survey/image-20260712220120985.png)

The `edit` folder holds intermediate artifacts: text animations, segments, scripts, validation, and finals.

![edit project outputs](/images/posts/ai-video-generation-editing-survey/image-20260712220242553.png)

`project.md` stores the conversation trail so you can resume the job later:

```markdown
Session 1 — 2026-07-11

Strategy: 将 8分34秒竖屏口播素材压缩为 3 分钟以内的柬埔寨摆地摊分析视频。结构：开场设问 → 政策风险（2019法令+打车平台案例）→ 机会（信息差）→ 建议（选品/长期主义）→ 收尾（旅游签探市场+平价主义）。跳切去除口误和重复，保留打车平台被下架的核心案例。

Decisions:

16 段 EDL，总时长 2:58（178.3s）
调色 neutral_punch，无字幕，无动画
跳过重复口误段（打车平台操作重复、赋能段重复、长段啰嗦）
输出 preview.mp4（1080×1920，24fps，-14 LUFS）
Reasoning log:

打车案例保留 RIDE1-3 连贯叙事，删 RIDE2 中「好几万嘟嘟车」冗余
ADV3/ADV4 赋能段与 CLOSE 风土人情段为控时长暂删，保留 ADV1+ADV2 核心建议
词边界 + 50/80ms padding，30ms 音频淡入淡出
Session 1 — 2026-07-11 (update)

Added: 中文字幕（126条 ASS，Heiti SC，底部安全区）、6 个话题动画卡片（橙金配色，顶部弹出）。输出 final.mp4。

Outstanding: 如需更多动画或调整卡片样式/时间点，反馈即可。

Session 2 — 2026-07-11

Strategy: 从零合成 Hugo + LoveIt + Wrangler CLI 教程视频（3 分钟紧凑版）。终端动画展示各步骤命令，ElevenLabs 男声（Daniel）旁白，键盘/whoosh/成功音效，PIL 字幕 overlay 烧录（本机 ffmpeg 无 libass）。

Decisions:

7 段结构：开场 → 安装/建站 → LoveIt 主题 → 写文章 → 本地预览 → Wrangler 部署 → 收尾
1920×1080@24fps，Catppuccin 终端配色，Menlo 等宽字体
总时长 1:50（110s），紧凑节奏
输出 edit/hugo-tutorial/final.mp4
Reasoning log:

amix duration=longest 修复 whoosh 段被截断至 0.33s 的问题
PIL RGBA overlay 替代 subtitles filter（ffmpeg 未编译 libass）
Outstanding: 如需延长至满 3 分钟或替换为真实录屏，反馈即可。
```

### Takeaways

The final cut looked solid enough for light / rough editing. I am not embedding that video here; try it yourself if interested. Cost is mainly LLM tokens (whatever model you wire up; DeepSeek V4 worked in a quick test, roughly a couple of RMB) plus ElevenLabs credits. New ElevenLabs accounts get about 10,000 credits; this edit used around 500.

## OpenMontage

> https://github.com/calesthio/OpenMontage

I will skip the install details. The interesting part is a local web UI with a task board so you can watch live progress.

My prompt was: “Make a 60-second animated explainer on how typhoon weather forms.” The board looks quite polished:

![OpenMontage task board](/images/posts/ai-video-generation-editing-survey/screenshot-2026-07-12-173854.png)

Text-to-speech used the local Xiaohongshu open-source model dots.tts ([Hugging Face Space](https://huggingface.co/spaces/rednote-hilab/dots.tts)): script shot text is turned into audio and mixed into the video.

![dots.tts voiceover flow](/images/posts/ai-video-generation-editing-survey/screenshot-2026-07-12-174023.png)

Projects land under `projects/`; finals under `exports/`.

![OpenMontage project and export dirs](/images/posts/ai-video-generation-editing-survey/image-20260712222748939.png)

The resulting clip:

<video controls playsinline preload="metadata" src="/videos/posts/ai-video-generation-editing-survey/typhoon-formation-explainer.mp4"></video>

### Takeaways

Quality is average—you can tell it is an AI pipeline product. Fine for simple needs. This was only a quick test without prompt tuning; I will dig deeper later.
