---
title: 'AI 在视频生成和智能剪辑方向的应用调研'
date: '2026-07-12T22:45:00+08:00'
draft: false
description: '最近对 AI 在视频生成和智能剪辑方向做了一些研究，记录 video-use、OpenMontage、Remotion、dots.tts、HyperFrames 等开源工具的试用体验。'
categories: ['技术']
tags: ['ai', 'video', 'openmontage', 'video-use']
featuredImage: '/images/posts/ai-video-generation-editing-survey/featured.jpg'
featuredImagePreview: '/images/posts/ai-video-generation-editing-survey/featured.jpg'
---

最近对 AI 在视频生成和智能剪辑方向做了一些研究，这篇文章进行一下相关记录。

<!--more-->

主要了解了一下这些开源的工具/技术：video-use、OpenMontage、Remotion、dots.tts、HyperFrames。这些分别是什么呢：

| 工具        | 描述                                                         |
| ----------- | ------------------------------------------------------------ |
| video-use   | 用 AI coding agent 精剪已有素材（转写 → 切点 → 调色/字幕/叠加 → 成片）的开源工作流。 |
| OpenMontage | 把 coding agent 变成整间视频制片厂，从调研、脚本、配音到合成的端到端生产系统。 |
| Remotion    | 用 React 写可编程视频，按帧渲染成 MP4 的开源框架。           |
| dots.tts    | 小红书开源的本地 TTS 模型，用文字（可加参考音）生成高质量语音。 |
| HyperFrames | 用 HTML/CSS/GSAP 写浏览器动画构图，再确定性抓帧渲染成视频的工具。 |

## Video-USE

> https://github.com/browser-use/video-use

### 安装

安装依赖相对来说比较简单，当然你也可以通过提示词直接让你的 agent 安装它。

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

手动安装：

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

其整体目录结构如下：

![video-use 目录结构](/images/posts/ai-video-generation-editing-survey/image-20260712215207727.png)

### 初尝试

它的工作原理主要是以音频为主（口播类），通过识别音频转成文字，模型去分析文本，写脚本，渲染，生成交付。当然，这是个 SKILL，你可以和 vibe-coding 一样，交互式地去控制整个剪辑的节奏和方向。试用下来还是很有感觉的。

我使用了 cc-switch 来管理 SKILL，AGENT 使用的 Cursor（当然任意 agent 都可以）。

![cc-switch 管理 SKILL](/images/posts/ai-video-generation-editing-survey/image-20260712215338858.png)

这是一个 8 分钟左右的口播原素材，以下是其分析的结果。它会分析出来整体口播的内容并将其内容结构分析出来，然后一些口误/重复/啰嗦的部分会标注出来，便于后续剪辑。底层调用的 ffmpeg 来实现，音频转录用的 ElevenLabs。

![口播分析与结构](/images/posts/ai-video-generation-editing-survey/image-20260712215633323.png)

提供剪辑策略，并询问你的建议。

![剪辑策略建议](/images/posts/ai-video-generation-editing-survey/image-20260712220120985.png)

edit 里就是它操作过程中产生的文件，包括文字动画、分段、脚本、验证及成片等。

![edit 工程产物](/images/posts/ai-video-generation-editing-survey/image-20260712220242553.png)

这是 project.md 的内容，它的作用是记录下来你们的对话过程，便于你下次继续该工程。

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

### 总结

看完成片，确实效果不错。处理一些简单的剪辑工作（粗剪），我觉得是够了。视频就不便于展示了，有兴趣可以自行尝试。这个工具主要是消耗 token（看你接的是什么 LLM，实测 DeepSeek V4 也可用，简单测试一次消耗大概一两块吧）和 ElevenLabs 的 API 点数。注册 ElevenLabs 初用户是有 10000 点数，这一次剪辑用掉了大概 500 左右。

## OpenMontage

> https://github.com/calesthio/OpenMontage

安装过程就先不写了，测试下来还是蛮有意思。它会在本地开启一个 web 服务，给你展示看板任务，让你知道它实时进展。

我这里给它下发的任务是，“制作一个 60 秒的动画科普视频，解释台风天气是如何形成的”，下图是它提供的任务看板，还是挺炫酷的。

![OpenMontage 任务看板](/images/posts/ai-video-generation-editing-survey/screenshot-2026-07-12-173854.png)

文本生成音频，调用的本地的小红书开源的 TTS 模型 dots.tts，https://huggingface.co/spaces/rednote-hilab/dots.tts，这里可以试用。也就是把脚本里写的分镜里的文本转成音频合成到视频里。

![dots.tts 配音流程](/images/posts/ai-video-generation-editing-survey/screenshot-2026-07-12-174023.png)

它最后会在 projects 目录下生成当前的工程目录，生成的成片在 exports 下。

![OpenMontage 工程与导出目录](/images/posts/ai-video-generation-editing-survey/image-20260712222748939.png)

我们来看一下成片：

<video controls playsinline preload="metadata" src="/videos/posts/ai-video-generation-editing-survey/typhoon-formation-explainer.mp4"></video>

### 总结

做出来的效果一般，一眼就可以看出来是 AI 流水线出来的产物。不过应付一些简单的需求也是够了。不过，我也只是简单测试一下，没有在提示词上进行调优，后续再深入使用一下吧。
