(() => {
  const app = document.getElementById("app");
  const progressWrap = document.getElementById("progressWrap");
  const progressFill = document.getElementById("progressFill");
  const progressLabel = document.getElementById("progressLabel");

  const state = {
    step: -1, // -1 intro, 0..n-1 questions, n results
    answers: {},
    multipliers: { feasibility: 1, niche_bias: 1 },
    results: null,
    shareName: "",
  };

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  const seoContent = document.getElementById("seoContent");
  const DEFAULT_TITLE = document.title;
  const DEFAULT_DESC =
    document.querySelector('meta[name="description"]')?.getAttribute("content") || "";

  function setMetaDescription(text) {
    const el = document.querySelector('meta[name="description"]');
    if (el) el.setAttribute("content", text);
  }

  function setSeoLandingVisible(visible) {
    if (!seoContent) return;
    seoContent.hidden = !visible;
    document.body.classList.toggle("quiz-active", !visible);
  }

  function setProgress() {
    if (state.step < 0 || state.step >= QUESTIONS.length) {
      progressWrap.hidden = true;
      return;
    }
    progressWrap.hidden = false;
    const pct = ((state.step + 1) / QUESTIONS.length) * 100;
    progressFill.style.width = `${pct}%`;
    progressLabel.textContent = `${state.step + 1} / ${QUESTIONS.length}`;
    progressWrap.querySelector('[role="progressbar"]').setAttribute("aria-valuenow", String(Math.round(pct)));
  }

  function selectedIds(qid) {
    const v = state.answers[qid];
    if (!v) return [];
    return Array.isArray(v) ? v : [v];
  }

  function goNext() {
    const q = QUESTIONS[state.step];
    if (!q || !canProceed(q)) return;
    if (state.step === QUESTIONS.length - 1) {
      const profile = gatherProfile();
      state.results = {
        profile,
        ranked: matchNiches(profile),
      };
      state.step = QUESTIONS.length;
      renderResults();
      return;
    }
    state.step += 1;
    renderQuestion({ animate: false });
  }

  function toggleOption(question, optionId) {
    if (question.type === "single") {
      state.answers[question.id] = optionId;
      // 直接进入下一题，避免「回闪选中态」+ 再次入场动画
      window.clearTimeout(state._autoNextTimer);
      goNext();
      return;
    }
    const cur = new Set(selectedIds(question.id));
    if (cur.has(optionId)) {
      cur.delete(optionId);
    } else {
      if (cur.size >= (question.max || 99)) return;
      cur.add(optionId);
    }
    state.answers[question.id] = [...cur];

    // 多选凑满：直接下一题；未满才重绘当前题以更新勾选
    if (cur.size >= (question.max || 99)) {
      window.clearTimeout(state._autoNextTimer);
      goNext();
      return;
    }
    renderQuestion({ animate: false });
  }

  function canProceed(question) {
    const ids = selectedIds(question.id);
    return ids.length > 0;
  }

  function gatherProfile() {
    const scores = {};
    const multipliers = { feasibility: 1, niche_bias: 1 };
    const avoid = {};

    for (const q of QUESTIONS) {
      const ids = selectedIds(q.id);
      for (const oid of ids) {
        const opt = q.options.find((o) => o.id === oid);
        if (!opt) continue;
        for (const [tag, w] of Object.entries(opt.tags || {})) {
          scores[tag] = (scores[tag] || 0) + w;
        }
        if (opt.weights) {
          for (const [k, v] of Object.entries(opt.weights)) {
            multipliers[k] = (multipliers[k] || 1) * v;
          }
        }
        if (opt.avoid) {
          for (const [tag, w] of Object.entries(opt.avoid)) {
            avoid[tag] = (avoid[tag] || 0) + w;
          }
        }
      }
    }

    // soft-penalty avoided tags in profile
    for (const [tag, w] of Object.entries(avoid)) {
      scores[tag] = (scores[tag] || 0) - w * 2.2;
    }

    return { scores, multipliers, avoid };
  }

  function matchNiches(profile) {
    const { scores, multipliers } = profile;
    const feas = multipliers.feasibility || 1;
    const bias = multipliers.niche_bias || 1;

    const ranked = NICHES.map((niche) => {
      let raw = 0;
      let maxPossible = 0;
      const hits = [];

      for (const [tag, need] of Object.entries(niche.tags)) {
        maxPossible += need * 3;
        const have = scores[tag] || 0;
        if (have > 0) {
          const contribution = Math.min(have, 4) * need;
          raw += contribution;
          hits.push({ tag, need, have, contribution });
        } else if (have < 0) {
          raw += have * need; // avoided
        }
      }

      // platform / format soft boost when user chose flex
      if ((scores.plat_flex || 0) > 0) raw += 2;

      let score = raw * feas * bias;

      // crowd penalty lightly if user prefers blue ocean
      if ((scores.compete_blue || 0) > 0 && /很高|高/.test(niche.crowd)) {
        score *= 0.9;
      }
      if ((scores.compete_red || 0) > 0 && /低/.test(niche.crowd)) {
        score *= 0.92;
      }

      // time low: penalize high difficulty long-form heavy niches
      if ((scores.time_low || 0) > 0 && (niche.tags.format_long || 0) >= 2) {
        score *= 0.85;
      }

      hits.sort((a, b) => b.contribution - a.contribution);

      // 理论满分（与最终 score 同一口径），用于算匹配度
      const idealScore = Math.max(1, maxPossible * feas * bias);

      return {
        ...niche,
        score: Math.max(0, score),
        idealScore,
        hits: hits.slice(0, 5),
      };
    });

    // 排序与展示必须同一口径：按最终加权分排序，再映射匹配度
    ranked.sort((a, b) => b.score - a.score);

    const top = ranked[0];
    const topAbsPct = top
      ? Math.min(92, Math.max(48, Math.round((top.score / top.idealScore) * 100)))
      : 60;

    for (const n of ranked) {
      // 相对 TOP1 的得分比例 × TOP1 绝对匹配度 → 保证 TOP1 ≥ TOP2 ≥ TOP3
      const relative = top && top.score > 0 ? n.score / top.score : 0;
      n.matchPct = Math.min(99, Math.max(5, Math.round(relative * topAbsPct)));
    }

    return ranked;
  }

  function explain(profile, top) {
    const reasons = [];
    const s = profile.scores;

    const skillMap = [
      ["tech", "你在技术/工具上有可教的资产"],
      ["writing", "你的表达与写作能力适合内容型账号"],
      ["design", "审美与设计感可转化为视觉内容优势"],
      ["career", "职场/求职经验容易建立信任"],
      ["money", "你对搞钱/副业话题有持续兴趣或经验"],
      ["parenting", "家庭育儿身份是强信任标签"],
      ["fitness", "健身饮食能做成强打卡型内容"],
      ["beauty", "穿搭美妆适合种草与列表体"],
      ["food", "吃喝探店容易本地化起量"],
      ["business", "经营视角适合获客/案例型内容"],
      ["ai", "AI 提效是当前高需求切口"],
    ];
    for (const [tag, text] of skillMap) {
      if ((s[tag] || 0) >= 3) reasons.push(text);
    }

    if ((s.on_camera || 0) >= 2) reasons.push("你能接受出镜，短视频路径更顺");
    if ((s.off_camera || 0) >= 2) reasons.push("你偏不出镜，更适合图文或录屏");
    if ((s.teach || 0) >= 3 || (s.role_teach || 0) >= 2) reasons.push("你倾向「教别人」，教程/方法论赛道更匹配");
    if ((s.role_curator || 0) >= 2) reasons.push("种草选型角色适合清单/测评赛道");
    if ((s.mon_course || 0) >= 2) reasons.push("变现目标偏课程/咨询，需要可沉淀的专业知识");
    if ((s.mon_shop || 0) >= 2) reasons.push("你更想带货，需要选品与信任感并行");
    if ((s.compete_blue || 0) >= 2) reasons.push("你更能接受冷启动，可走更垂直切口");

    if (!reasons.length) {
      reasons.push("综合兴趣、形态与受众偏好，以下赛道启动成本相对可控");
    }

    reasons.push(`主推切入点：${top.hook}`);
    return reasons.slice(0, 6);
  }

  function renderIntro() {
    document.title = DEFAULT_TITLE;
    setMetaDescription(DEFAULT_DESC);
    setSeoLandingVisible(true);
    setProgress();
    app.innerHTML = `
      <section class="screen hero" id="quiz">
        <div class="eyebrow">18 道选择题 · 3 个具体赛道</div>
        <h1>找到你的<br /><span>自媒体 Niche</span></h1>
        <p class="hero-lead">
          不知道自媒体做什么方向？用选择题完成<strong>账号定位测评</strong>：
          按技能、兴趣、内容形态、受众与变现目标加权匹配，输出小红书 / 抖音 / 视频号 / B站可执行赛道与开局选题。
        </p>
        <div class="hero-meta">
          <div><strong>约 4 分钟</strong> 答完</div>
          <div><strong>全选择题</strong> 单选 / 多选</div>
          <div><strong>结果可复测</strong> 随时重来</div>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" id="startBtn" type="button">开始 Niche 定位测评</button>
        </div>
      </section>
    `;
    document.getElementById("startBtn").onclick = () => {
      state.step = 0;
      state.answers = {};
      state.results = null;
      renderQuestion();
    };
  }

  function renderQuestion(opts = {}) {
    const animate = opts.animate === true;
    const q = QUESTIONS[state.step];
    setSeoLandingVisible(false);
    document.title = `第 ${state.step + 1}/${QUESTIONS.length} 题｜自媒体 Niche 定位测评 - 赛道雷达`;
    setProgress();
    const selected = new Set(selectedIds(q.id));
    const multiHint =
      q.type === "multi"
        ? `<p class="q-hint">${q.hint || `可多选，最多 ${q.max} 项`} · 已选 ${selected.size}/${q.max} · 选满自动下一题</p>`
        : `<p class="q-hint">${q.hint || "单选，点选后自动进入下一题"}</p>`;

    app.innerHTML = `
      <section class="screen panel ${animate ? "screen-enter" : "screen-swap"}">
        <div class="q-kicker">QUESTION ${String(state.step + 1).padStart(2, "0")}</div>
        <h2 class="q-title">${q.title}</h2>
        ${multiHint}
        <div class="options" role="group" aria-label="${q.title}">
          ${q.options
            .map((opt) => {
              const isOn = selected.has(opt.id);
              const locked =
                q.type === "multi" && !isOn && selected.size >= (q.max || 99);
              return `
                <button
                  type="button"
                  class="option ${q.type} ${isOn ? "selected" : ""}"
                  data-id="${opt.id}"
                  ${locked ? "disabled" : ""}
                >
                  <span class="option-mark">${isOn ? "✓" : ""}</span>
                  <span>${opt.label}</span>
                </button>
              `;
            })
            .join("")}
        </div>
        <div class="nav-row">
          <button class="btn btn-ghost" id="prevBtn" type="button" ${
            state.step === 0 ? "disabled" : ""
          }>上一题</button>
          ${
            q.type === "multi"
              ? `<button class="btn btn-primary" id="nextBtn" type="button" ${
                  canProceed(q) ? "" : "disabled"
                }>${state.step === QUESTIONS.length - 1 ? "查看赛道建议" : "下一题"}</button>`
              : `<span class="nav-hint">${
                  state.step === QUESTIONS.length - 1 ? "点选后查看结果" : "点选后自动下一题"
                }</span>`
          }
        </div>
      </section>
    `;

    app.querySelectorAll(".option").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.clearTimeout(state._autoNextTimer);
        toggleOption(q, btn.dataset.id);
      });
    });
    document.getElementById("prevBtn").onclick = () => {
      window.clearTimeout(state._autoNextTimer);
      state.step = Math.max(0, state.step - 1);
      renderQuestion({ animate: false });
    };
    const nextBtn = document.getElementById("nextBtn");
    if (nextBtn) {
      nextBtn.onclick = () => {
        window.clearTimeout(state._autoNextTimer);
        goNext();
      };
    }
  }

  function renderResults() {
    setProgress();
    setSeoLandingVisible(true);
    const ranked = state.results.ranked;
    const top = ranked[0];
    const alts = ranked.slice(1, 3);
    const reasons = explain(state.results.profile, top);
    const maxScore = Math.max(...ranked.slice(0, 5).map((n) => n.score), 1);

    document.title = `${top.track}｜你的自媒体赛道建议 - 赛道雷达`;
    setMetaDescription(
      `测评建议主推「${top.track}」。平台：${top.platform}；形态：${top.format}。另有备选赛道可对比验证。`
    );

    app.innerHTML = `
      <section class="screen">
        <div class="results-head">
          <div class="eyebrow">Your Niche Report</div>
          <h1>你的主推自媒体赛道已生成</h1>
          <p>以下结果按能力、兴趣、形态、受众与变现目标综合排序。先做主推 4 周，再决定是否切换备选。</p>
        </div>

        <article class="primary-card">
          <div class="rank-pill">TOP 1 · 匹配度 ${top.matchPct}%</div>
          <p class="niche-direction">${top.direction}</p>
          <h2 class="niche-track">${top.track}</h2>
          <div class="meta-grid">
            <div class="meta-item"><span>推荐平台</span>${top.platform}</div>
            <div class="meta-item"><span>内容形态</span>${top.format}</div>
            <div class="meta-item"><span>难度</span>${top.difficulty}</div>
            <div class="meta-item"><span>拥挤度</span>${top.crowd}</div>
          </div>
          <p class="hook">${top.hook}</p>
          <div class="score-bar">
            <div class="label"><span>综合得分</span><span>${Math.round(top.score)}</span></div>
            <div class="track"><div class="fill" style="width:${Math.round(
              (top.score / maxScore) * 100
            )}%"></div></div>
          </div>
        </article>

        <div class="alt-list">
          ${alts
            .map(
              (n, i) => `
            <article class="alt-card">
              <div class="rank-pill">TOP ${i + 2} · ${n.matchPct}%</div>
              <h3>${n.track}</h3>
              <p>${n.direction} · ${n.platform} · ${n.format}</p>
              <p style="margin-top:8px">${n.hook}</p>
            </article>
          `
            )
            .join("")}
        </div>

        <div class="why-box">
          <h3>为什么是这些赛道</h3>
          <ul>
            ${reasons.map((r) => `<li>${r}</li>`).join("")}
          </ul>
        </div>

        <section class="share-panel" aria-labelledby="shareTitle">
          <div class="share-head">
            <h3 id="shareTitle">分享我的赛道</h3>
            <p>填入名字，生成个性化文案，一键分享到社交媒体。</p>
          </div>
          <label class="share-name-label" for="shareName">你的名字 / 昵称</label>
          <div class="share-name-row">
            <input
              id="shareName"
              class="share-input"
              type="text"
              maxlength="20"
              placeholder="例如：阿陈、Simon"
              autocomplete="nickname"
              value="${escapeHtml(state.shareName || "")}"
            />
            <button class="btn btn-ghost" id="previewShareBtn" type="button">预览文案</button>
          </div>
          <textarea id="sharePreview" class="share-preview" rows="8" readonly aria-label="分享文案预览"></textarea>
          <div class="share-actions" role="group" aria-label="分享渠道">
            <button class="btn btn-primary" id="nativeShareBtn" type="button">系统分享</button>
            <button class="btn btn-ghost" id="copyShareBtn" type="button">复制文案</button>
            <button class="btn btn-ghost" id="weiboShareBtn" type="button">微博</button>
            <button class="btn btn-ghost" id="xShareBtn" type="button">X / Twitter</button>
            <button class="btn btn-ghost" id="downloadCardBtn" type="button">下载分享图</button>
          </div>
          <p class="share-tip" id="shareTip">小红书 / 抖音 / 微信：点「复制文案」或「下载分享图」后到 App 粘贴发布。</p>
        </section>

        <div class="footer-actions">
          <button class="btn btn-primary" id="retryBtn" type="button">重新测评</button>
          <button class="btn btn-ghost" id="top10Btn" type="button">查看完整 Top 10</button>
        </div>
        <div id="top10" hidden style="margin-top:18px"></div>
      </section>
    `;

    bindShareUI(top, alts);

    document.getElementById("retryBtn").onclick = () => {
      state.step = -1;
      state.answers = {};
      state.results = null;
      renderIntro();
    };

    document.getElementById("top10Btn").onclick = () => {
      const box = document.getElementById("top10");
      if (!box.hidden) {
        box.hidden = true;
        return;
      }
      box.hidden = false;
      box.innerHTML = `
        <div class="panel">
          <h3 style="margin-top:0">完整排序 Top 10</h3>
          <ol style="margin:0;padding-left:20px;color:#c6d3e3">
            ${ranked
              .slice(0, 10)
              .map(
                (n) =>
                  `<li style="margin:8px 0"><strong>${n.track}</strong> — ${n.direction}（${Math.round(
                    n.score
                  )} 分）</li>`
              )
              .join("")}
          </ol>
        </div>
      `;
    };
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function siteUrl() {
    try {
      return location.href.split("#")[0].split("?")[0];
    } catch {
      return "https://niche-radar.example/";
    }
  }

  function getShareName() {
    const input = document.getElementById("shareName");
    const name = (input?.value || state.shareName || "").trim() || "我";
    state.shareName = name === "我" ? "" : name;
    try {
      if (state.shareName) localStorage.setItem("niche_share_name", state.shareName);
    } catch (_) {}
    return name;
  }

  function buildShareText(name, top, alts) {
    const lines = [
      `我是${name}，刚用「赛道雷达」测出了自己的自媒体 Niche 👇`,
      ``,
      `🎯 主推赛道：${top.track}`,
      `📌 方向：${top.direction}`,
      `📱 平台：${top.platform}`,
      `✍️ 形态：${top.format}`,
      `⚡ 匹配度：${top.matchPct}%`,
      `💡 开局切入：${top.hook}`,
      ``,
      `备选：`,
      ...alts.map((n, i) => `${i + 2}. ${n.track}（${n.matchPct}%）`),
      ``,
      `你也来测测自己的赛道：`,
      siteUrl(),
      ``,
      `#自媒体定位 #Niche #内容赛道 #赛道雷达`,
    ];
    return lines.join("\n");
  }

  function setShareTip(msg, ok = true) {
    const tip = document.getElementById("shareTip");
    if (!tip) return;
    tip.textContent = msg;
    tip.classList.toggle("ok", ok);
    tip.classList.toggle("err", !ok);
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }

  function drawShareCard(name, top, alts) {
    const canvas = document.createElement("canvas");
    const w = 1080;
    const h = 1440;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");

    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "#0c1118");
    bg.addColorStop(0.55, "#141b25");
    bg.addColorStop(1, "#1a2433");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "rgba(255,106,61,0.18)";
    ctx.beginPath();
    ctx.arc(900, 120, 260, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(94,234,212,0.12)";
    ctx.beginPath();
    ctx.arc(120, 1280, 220, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#5eead4";
    ctx.font = "500 28px sans-serif";
    ctx.fillText("赛道雷达  ·  NICHE REPORT", 80, 120);

    ctx.fillStyle = "#e8eef7";
    ctx.font = "700 64px sans-serif";
    ctx.fillText(`${name} 的自媒体赛道`, 80, 220);

    ctx.fillStyle = "#ff6a3d";
    ctx.font = "600 30px sans-serif";
    ctx.fillText(`TOP 1  ·  匹配度 ${top.matchPct}%`, 80, 300);

    ctx.fillStyle = "#e8eef7";
    wrapText(ctx, top.track, 80, 380, w - 160, 56, "700 48px sans-serif");

    ctx.fillStyle = "#8b9bb0";
    ctx.font = "400 28px sans-serif";
    ctx.fillText(top.direction, 80, 520);

    const metaY = 600;
    drawMeta(ctx, 80, metaY, "平台", top.platform);
    drawMeta(ctx, 560, metaY, "形态", top.format);
    drawMeta(ctx, 80, metaY + 140, "难度", top.difficulty);
    drawMeta(ctx, 560, metaY + 140, "拥挤度", top.crowd);

    ctx.fillStyle = "rgba(255,255,255,0.04)";
    roundRect(ctx, 80, 920, w - 160, 200, 24);
    ctx.fill();
    ctx.fillStyle = "#ff6a3d";
    ctx.fillRect(80, 920, 8, 200);
    ctx.fillStyle = "#d7e0ec";
    wrapText(ctx, top.hook, 110, 970, w - 220, 40, "400 28px sans-serif");

    ctx.fillStyle = "#8b9bb0";
    ctx.font = "400 24px sans-serif";
    const altLine = alts.map((n, i) => `Top${i + 2} ${n.track}`).join("  ·  ");
    wrapText(ctx, altLine, 80, 1180, w - 160, 34, "400 24px sans-serif");

    ctx.fillStyle = "#5eead4";
    ctx.font = "500 26px sans-serif";
    ctx.fillText("来测测你的赛道 → 赛道雷达", 80, 1360);

    return canvas;
  }

  function drawMeta(ctx, x, y, label, value) {
    ctx.fillStyle = "#8b9bb0";
    ctx.font = "400 22px sans-serif";
    ctx.fillText(label, x, y);
    ctx.fillStyle = "#e8eef7";
    ctx.font = "600 30px sans-serif";
    wrapText(ctx, String(value), x, y + 48, 400, 36, "600 30px sans-serif");
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, font) {
    ctx.font = font;
    const chars = String(text).split("");
    let line = "";
    let cy = y;
    for (const ch of chars) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, cy);
        line = ch;
        cy += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, cy);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  function bindShareUI(top, alts) {
    try {
      const saved = localStorage.getItem("niche_share_name");
      if (saved && !state.shareName) state.shareName = saved;
      const input = document.getElementById("shareName");
      if (input && state.shareName) input.value = state.shareName;
    } catch (_) {}

    const preview = document.getElementById("sharePreview");
    const refreshPreview = () => {
      preview.value = buildShareText(getShareName(), top, alts);
    };
    refreshPreview();

    document.getElementById("shareName").addEventListener("input", refreshPreview);
    document.getElementById("previewShareBtn").onclick = refreshPreview;

    document.getElementById("copyShareBtn").onclick = async () => {
      try {
        await copyText(buildShareText(getShareName(), top, alts));
        setShareTip("文案已复制，去小红书 / 抖音 / 微信粘贴即可。");
      } catch {
        setShareTip("复制失败，请手动选中上方文案复制。", false);
      }
    };

    document.getElementById("nativeShareBtn").onclick = async () => {
      const name = getShareName();
      const text = buildShareText(name, top, alts);
      const url = siteUrl();
      try {
        if (navigator.share) {
          const data = { title: `${name} 的自媒体赛道｜赛道雷达`, text, url };
          if (navigator.canShare) {
            try {
              const canvas = drawShareCard(name, top, alts);
              const blob = await canvasToBlob(canvas);
              if (blob) {
                const file = new File([blob], "niche-report.png", { type: "image/png" });
                const withFile = { ...data, files: [file] };
                if (navigator.canShare(withFile)) {
                  await navigator.share(withFile);
                  setShareTip("已调用系统分享（含分享图）。");
                  return;
                }
              }
            } catch (_) {}
          }
          await navigator.share(data);
          setShareTip("已调用系统分享面板。");
          return;
        }
        await copyText(text);
        setShareTip("当前浏览器不支持系统分享，已改为复制文案。");
      } catch (err) {
        if (err && err.name === "AbortError") {
          setShareTip("已取消分享。");
          return;
        }
        setShareTip("分享未完成，可改用复制文案或下载分享图。", false);
      }
    };

    document.getElementById("weiboShareBtn").onclick = () => {
      const text = buildShareText(getShareName(), top, alts);
      const url =
        "https://service.weibo.com/share/share.php?url=" +
        encodeURIComponent(siteUrl()) +
        "&title=" +
        encodeURIComponent(text.slice(0, 120));
      window.open(url, "_blank", "noopener,noreferrer,width=600,height=520");
      setShareTip("已打开微博分享页。");
    };

    document.getElementById("xShareBtn").onclick = () => {
      const text = buildShareText(getShareName(), top, alts);
      const url =
        "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text.slice(0, 240));
      window.open(url, "_blank", "noopener,noreferrer,width=600,height=520");
      setShareTip("已打开 X / Twitter 分享页。");
    };

    document.getElementById("downloadCardBtn").onclick = async () => {
      try {
        const name = getShareName();
        const canvas = drawShareCard(name, top, alts);
        const blob = await canvasToBlob(canvas);
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `赛道雷达-${name}-niche.png`;
        a.click();
        URL.revokeObjectURL(a.href);
        setShareTip("分享图已下载，可发到小红书 / 朋友圈 / 社交媒体。");
      } catch {
        setShareTip("生成分享图失败，请换浏览器重试。", false);
      }
    };
  }

  try {
    state.shareName = localStorage.getItem("niche_share_name") || "";
  } catch (_) {
    state.shareName = "";
  }

  renderIntro();
})();
