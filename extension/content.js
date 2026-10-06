(() => {
  const shared = globalThis.NowPlannerShared;
  if (!shared || document.getElementById("nowplanner-import-root")) return;

  let tableObserver = null;
  let currentPayload = null;

  injectLauncher();
  observeTable();

  function injectLauncher() {
    const root = document.createElement("div");
    root.id = "nowplanner-import-root";
    root.innerHTML = `
      <button class="np-launch-button" type="button" id="np-open-button">
        <span class="np-launch-mark"></span>
        导入到此刻
      </button>
      <div class="np-panel" id="np-panel" hidden>
        <div class="np-panel-head">
          <div><strong>此刻 · 课表导入</strong><span id="np-panel-subtitle">正在连接教务课表</span></div>
          <button type="button" id="np-close-button" aria-label="关闭">×</button>
        </div>
        <div class="np-panel-body" id="np-panel-body"></div>
      </div>
    `;
    document.documentElement.appendChild(root);
    document.getElementById("np-open-button").addEventListener("click", openPanel);
    document.getElementById("np-close-button").addEventListener("click", closePanel);
  }

  function observeTable() {
    if (document.querySelector(".kb_table")) {
      document.getElementById("np-open-button").classList.add("is-ready");
      return;
    }
    tableObserver = new MutationObserver(() => {
      if (document.querySelector(".kb_table")) {
        document.getElementById("np-open-button").classList.add("is-ready");
        tableObserver?.disconnect();
      }
    });
    tableObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  async function openPanel() {
    const panel = document.getElementById("np-panel");
    panel.hidden = false;
    await renderOverview();
  }

  function closePanel() {
    document.getElementById("np-panel").hidden = true;
  }

  async function renderOverview(message = "") {
    const body = document.getElementById("np-panel-body");
    body.innerHTML = `<div class="np-loading"><i></i><p>${message || "正在读取本学期课表…"}</p></div>`;
    try {
      currentPayload = await collectSchedule((completed, total) => {
        body.innerHTML = `<div class="np-loading"><i></i><p>正在读取第 ${completed}/${total} 周课表…</p></div>`;
      });
      renderPreview(currentPayload);
    } catch (error) {
      renderError(error.message || "读取课表失败。");
    }
  }

  async function collectSchedule(onProgress = () => {}) {
    const table = document.querySelector(".kb_table");
    if (!table) throw new Error("当前页面没有检测到课表，请先打开“我的课表”。");
    const statusText = document.getElementById("li_showWeek")?.textContent || "";
    const status = shared.parseWeekStatus(statusText) || { currentWeek: 1, totalWeeks: 20 };
    const selectedDate = document.getElementById("rq")?.value || new Date().toISOString().slice(0, 10);
    const termStart = shared.inferTermStart(selectedDate, status.currentWeek);
    const modeValue = document.getElementById("sjms")?.value || "";
    const occurrences = [];
    let failures = 0;

    for (let week = 1; week <= status.totalWeeks; week += 1) {
      onProgress(week, status.totalWeeks);
      const monday = new Date(termStart);
      monday.setDate(monday.getDate() + (week - 1) * 7);
      try {
        const html = await loadWeekHtml(shared.formatDateInput(monday), modeValue);
        occurrences.push(...shared.parseKbTableHtml(html, week));
      } catch (error) {
        failures += 1;
        if (week === status.currentWeek) {
          const currentHtml = table.outerHTML;
          occurrences.push(...shared.parseKbTableHtml(currentHtml, week));
        }
      }
    }

    const courses = shared.mergeOccurrences(occurrences);
    if (!courses.length) throw new Error("没有解析到课程，请确认课表页面已经完整加载。");
    return {
      semester: {
        name: inferSemesterName(termStart),
        startDate: shared.formatDateInput(termStart),
        weekCount: status.totalWeeks,
        sourceKey: `${selectedDate}|${status.totalWeeks}`
      },
      courses,
      failures
    };
  }

  async function loadWeekHtml(date, modeValue) {
    const url = "/jsxsd/framework/main_index_loadkb.jsp";
    const body = new URLSearchParams({ rq: date, sjmsValue: modeValue });
    let response = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest" },
      body
    });
    if (!response.ok) {
      const query = new URLSearchParams({ rq: date, sjmsValue: modeValue });
      response = await fetch(`${url}?${query}`, { credentials: "include" });
    }
    if (!response.ok) throw new Error(`第 ${date} 周读取失败。`);
    const html = await response.text();
    if (/name=["']useraccount["']|Logon\.do/i.test(html)) throw new Error("教务登录状态已失效，请重新登录后再导入。");
    return html;
  }

  function inferSemesterName(termStart) {
    const start = new Date(termStart);
    const month = start.getMonth() + 1;
    const year = start.getFullYear();
    if (month >= 8) return `${year}-${year + 1}学年第一学期`;
    return `${year - 1}-${year}学年第二学期`;
  }

  function renderPreview(payload) {
    const first = payload.courses[0];
    const last = payload.courses.at(-1);
    document.getElementById("np-panel-subtitle").textContent = `${payload.courses.length} 门课程已解析`;
    document.getElementById("np-panel-body").innerHTML = `
      <div class="np-summary-grid">
        <label>学期名称<input id="np-semester-name" value="${escapeAttribute(payload.semester.name)}"></label>
        <label>开学日期<input id="np-semester-start" type="date" value="${payload.semester.startDate}"></label>
        <label>总周数<input id="np-semester-weeks" type="number" min="1" max="60" value="${payload.semester.weekCount}"></label>
      </div>
      <div class="np-course-list">
        ${payload.courses.slice(0, 8).map((course) => `<div><span>周${course.weekday}</span><strong>${escapeHtml(course.name)}</strong><em>${escapeHtml(course.startTime)}-${escapeHtml(course.endTime)}</em></div>`).join("")}
        ${payload.courses.length > 8 ? `<p>还有 ${payload.courses.length - 8} 门课程未展开</p>` : ""}
      </div>
      ${payload.failures ? `<p class="np-warning">有 ${payload.failures} 个周次请求失败，已尽可能使用当前页面数据补齐。</p>` : ""}
      <div class="np-actions"><button class="np-secondary" type="button" id="np-refresh">重新读取</button><button class="np-primary" type="button" id="np-import">确认导入</button></div>
    `;
    document.getElementById("np-refresh").addEventListener("click", () => renderOverview());
    document.getElementById("np-import").addEventListener("click", confirmImport);
  }

  async function confirmImport() {
    const body = document.getElementById("np-panel-body");
    if (!currentPayload) return;
    currentPayload.semester.name = document.getElementById("np-semester-name").value.trim() || currentPayload.semester.name;
    currentPayload.semester.startDate = document.getElementById("np-semester-start").value || currentPayload.semester.startDate;
    currentPayload.semester.weekCount = Number(document.getElementById("np-semester-weeks").value || currentPayload.semester.weekCount);
    body.innerHTML = `<div class="np-loading"><i></i><p>正在写入你的云端空间…</p></div>`;
    const result = await sendMessage({ type: "IMPORT_SCHEDULE", payload: currentPayload });
    if (result.ok) {
      renderSuccess(result.data);
      return;
    }
    if (result.error === "AUTH_REQUIRED") {
      renderKeyPrompt("需要先验证你的空间密钥。");
      return;
    }
    if (result.error === "CONFIG_REQUIRED") {
      renderConfigPrompt();
      return;
    }
    renderError(result.error || "导入失败。");
  }

  function renderKeyPrompt(message) {
    document.getElementById("np-panel-subtitle").textContent = "登录云端空间";
    document.getElementById("np-panel-body").innerHTML = `
      <p class="np-muted">${escapeHtml(message)} 扩展只会保存 Supabase 登录会话，不保存明文密钥。</p>
      <label class="np-key-label">空间密钥<input id="np-key" type="password" minlength="8" maxlength="128" placeholder="至少 8 位"></label>
      <p class="np-error" id="np-key-error"></p>
      <div class="np-actions"><button class="np-secondary" id="np-open-options" type="button">扩展设置</button><button class="np-primary" id="np-login" type="button">验证并导入</button></div>
    `;
    document.getElementById("np-open-options").addEventListener("click", () => sendMessage({ type: "OPEN_OPTIONS" }));
    document.getElementById("np-login").addEventListener("click", async () => {
      const key = document.getElementById("np-key").value;
      const result = await sendMessage({ type: "LOGIN_KEY", key });
      if (!result.ok) {
        document.getElementById("np-key-error").textContent = result.error;
        return;
      }
      await confirmImport();
    });
  }

  function renderConfigPrompt() {
    document.getElementById("np-panel-subtitle").textContent = "还需要完成扩展设置";
    document.getElementById("np-panel-body").innerHTML = `<p class="np-muted">请先填写 Supabase 项目地址和匿名公钥，然后返回教务页面重新导入。</p><div class="np-actions"><button class="np-primary" id="np-open-options" type="button">打开扩展设置</button></div>`;
    document.getElementById("np-open-options").addEventListener("click", () => sendMessage({ type: "OPEN_OPTIONS" }));
  }

  function renderSuccess(result) {
    document.getElementById("np-panel-subtitle").textContent = "导入完成";
    document.getElementById("np-panel-body").innerHTML = `<div class="np-success"><span>✓</span><strong>课表已同步到此刻</strong><p>本次导入 ${Number(result.imported || 0)} 门课程${result.removed ? `，移除 ${result.removed} 条过期课程` : ""}。手机和电脑打开网页即可看到。</p></div>`;
  }

  function renderError(message) {
    document.getElementById("np-panel-subtitle").textContent = "导入未完成";
    document.getElementById("np-panel-body").innerHTML = `<div class="np-error-box"><strong>读取失败</strong><p>${escapeHtml(message)}</p><button class="np-secondary" id="np-retry" type="button">重试</button></div>`;
    document.getElementById("np-retry").addEventListener("click", () => renderOverview());
  }

  function sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
        else resolve(response || { ok: false, error: "扩展没有响应。" });
      });
    });
  }

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replaceAll("`", "&#096;");
  }
})();
