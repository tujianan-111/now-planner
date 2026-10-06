(() => {
  "use strict";

  const STORAGE = {
    tasks: "now-planner.tasks.v1",
    courses: "now-planner.courses.v1",
    completed: "now-planner.completed.v1",
    skipped: "now-planner.skipped.v1"
  };

  const IMPORTANCE = {
    high: { label: "高", description: "关键任务", rank: 0 },
    medium: { label: "中", description: "常规任务", rank: 1 },
    low: { label: "低", description: "可以稍后", rank: 2 }
  };

  const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;

  const icons = {
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 5v5.42l3.3 1.9-1 1.73-4.3-2.48V7h2Z"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v13a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2h2V2Zm12 8H5v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9Z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.2 16.6-5-5L2.8 13l6.4 6.4L21.6 7 20.2 5.6 9.2 16.6Z"/></svg>',
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16.9 3.5 3.6 3.6L8.1 19.5 3.5 20.5l1-4.6L16.9 3.5Zm0 2.8L7 16.1l-.4 1.8 1.8-.4 9.7-9.8-1.2-1.4Zm2.2 1.6 1.4-1.4-2.2-2.2-1.4 1.4 2.2 2.2Z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.7 12H7.7L7 9Zm3 2v7h2v-7h-2Zm3 0v7h2v-7h-2Z"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4h2v11.2l4.6-4.6L19 12l-7 7-7-7 1.4-1.4 4.6 4.6V4Z"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7L8 5Z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h12.2l-4.6-4.6L14 6l7 7-7 7-1.4-1.4 4.6-4.6H5v-2Z"/></svg>'
  };

  const elements = {
    liveDate: document.getElementById("liveDate"),
    liveTime: document.getElementById("liveTime"),
    focusStatus: document.getElementById("focusStatus"),
    focusPrefix: document.querySelector("#focus-title span"),
    currentTaskTitle: document.getElementById("currentTaskTitle"),
    currentTaskMeta: document.getElementById("currentTaskMeta"),
    skipTaskButton: document.getElementById("skipTaskButton"),
    completeCurrentButton: document.getElementById("completeCurrentButton"),
    upNextList: document.getElementById("upNextList"),
    undoSkipButton: document.getElementById("undoSkipButton"),
    noticeText: document.getElementById("noticeText"),
    progressValue: document.getElementById("progressValue"),
    progressBar: document.getElementById("progressBar"),
    pendingCount: document.getElementById("pendingCount"),
    todayDoneCount: document.getElementById("todayDoneCount"),
    taskList: document.getElementById("taskList"),
    queueCount: document.getElementById("queueCount"),
    taskTab: document.getElementById("taskTab"),
    scheduleTab: document.getElementById("scheduleTab"),
    taskFormPanel: document.getElementById("taskFormPanel"),
    scheduleFormPanel: document.getElementById("scheduleFormPanel"),
    taskForm: document.getElementById("taskForm"),
    taskFormTitle: document.getElementById("taskFormTitle"),
    taskFormHint: document.getElementById("taskFormHint"),
    taskName: document.getElementById("taskName"),
    taskImportance: document.getElementById("taskImportance"),
    taskDuration: document.getElementById("taskDuration"),
    taskDeadline: document.getElementById("taskDeadline"),
    taskFormError: document.getElementById("taskFormError"),
    taskSubmitLabel: document.getElementById("taskSubmitLabel"),
    cancelTaskEditButton: document.getElementById("cancelTaskEditButton"),
    scheduleForm: document.getElementById("scheduleForm"),
    scheduleFormTitle: document.getElementById("scheduleFormTitle"),
    scheduleFormHint: document.getElementById("scheduleFormHint"),
    courseName: document.getElementById("courseName"),
    courseWeekday: document.getElementById("courseWeekday"),
    courseStart: document.getElementById("courseStart"),
    courseEnd: document.getElementById("courseEnd"),
    courseLocation: document.getElementById("courseLocation"),
    scheduleFormError: document.getElementById("scheduleFormError"),
    scheduleSubmitLabel: document.getElementById("scheduleSubmitLabel"),
    cancelScheduleEditButton: document.getElementById("cancelScheduleEditButton"),
    scheduleList: document.getElementById("scheduleList"),
    scheduleCount: document.getElementById("scheduleCount"),
    clearCompletedButton: document.getElementById("clearCompletedButton"),
    toastRegion: document.getElementById("toastRegion")
  };

  const state = {
    tasks: loadArray(STORAGE.tasks),
    courses: loadArray(STORAGE.courses),
    completed: loadArray(STORAGE.completed),
    skipped: new Set(),
    skippedDate: getDateKey(new Date()),
    editingTaskId: null,
    editingCourseId: null,
    lastSkipKey: null,
    lastCurrentKey: null,
    noticeOverride: "",
    noticeOverrideUntil: 0,
    lastMinuteKey: ""
  };

  loadSkipped();
  bindEvents();
  renderAll();
  updateClock();
  window.setInterval(tick, 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) tick(true);
  });

  function bindEvents() {
    elements.taskForm.addEventListener("submit", handleTaskSubmit);
    elements.scheduleForm.addEventListener("submit", handleScheduleSubmit);
    elements.skipTaskButton.addEventListener("click", skipCurrent);
    elements.completeCurrentButton.addEventListener("click", completeCurrent);
    elements.undoSkipButton.addEventListener("click", undoSkip);
    elements.taskList.addEventListener("click", handleTaskListClick);
    elements.scheduleList.addEventListener("click", handleScheduleListClick);
    elements.cancelTaskEditButton.addEventListener("click", resetTaskForm);
    elements.cancelScheduleEditButton.addEventListener("click", resetScheduleForm);
    elements.taskTab.addEventListener("click", () => activateTab("task"));
    elements.scheduleTab.addEventListener("click", () => activateTab("schedule"));
    elements.clearCompletedButton.addEventListener("click", clearCompleted);
  }

  function tick(forceRender = false) {
    const now = new Date();
    ensureSkippedDate(now);
    updateClock(now);

    const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
    if (forceRender || minuteKey !== state.lastMinuteKey) {
      state.lastMinuteKey = minuteKey;
      renderAll(now);
    }
  }

  function updateClock(now = new Date()) {
    elements.liveDate.textContent = new Intl.DateTimeFormat("zh-CN", {
      month: "long", day: "numeric", weekday: "long"
    }).format(now);

    elements.liveTime.textContent = new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
    }).format(now);
  }

  function renderAll(now = new Date()) {
    ensureSkippedDate(now);
    const focus = getCurrentItem(now);
    const queueItems = getRankedCandidates(now);

    renderFocus(focus, now);
    renderUpNext(queueItems, focus, now);
    renderTasks(queueItems, focus, now);
    renderSchedule(now);
    renderStats(now);
    renderNotice(focus, now);
    elements.queueCount.textContent = String(state.tasks.length);
    elements.undoSkipButton.hidden = !state.lastSkipKey || !state.skipped.has(state.lastSkipKey);
  }

  function renderFocus(item, now) {
    const titleChanged = state.lastCurrentKey !== getItemKey(item);
    state.lastCurrentKey = getItemKey(item);
    elements.currentTaskTitle.textContent = "";

    if (!item) {
      const hasSkipped = state.skipped.size > 0;
      const hasCompletedToday = state.completed.some((entry) => isSameDay(entry.completedAt, now));

      if (hasSkipped) {
        elements.focusStatus.textContent = "当前任务已跳过";
        elements.focusPrefix.textContent = "暂时没有";
        elements.currentTaskTitle.textContent = "等待重新安排";
        elements.currentTaskMeta.innerHTML = [
          metaChip(icons.clock, "点击“撤销刚才的跳过”可恢复"),
          metaChip(icons.pin, "跳过状态会在明天自动清空")
        ].join("");
      } else if (hasCompletedToday && state.tasks.length === 0) {
        elements.focusStatus.textContent = "今日队列已清空";
        elements.focusPrefix.textContent = "现在可以";
        elements.currentTaskTitle.textContent = "休息一下";
        elements.currentTaskMeta.innerHTML = [
          metaChip(icons.check, `今天已完成 ${state.completed.filter((entry) => isSameDay(entry.completedAt, now)).length} 项任务`),
          state.courses.length ? metaChip(icons.calendar, "下一节固定课程会自动提醒") : metaChip(icons.pin, "所有数据仍保存在本地")
        ].join("");
      } else if (state.courses.length && state.tasks.length === 0) {
        elements.focusStatus.textContent = "今天暂无待办";
        elements.focusPrefix.textContent = "按计划";
        elements.currentTaskTitle.textContent = "课前再来";
        elements.currentTaskMeta.innerHTML = [
          metaChip(icons.calendar, "固定课程会按周自动出现"),
          metaChip(icons.pin, `已录入 ${state.courses.length} 节课程`)
        ].join("");
      } else {
        elements.focusStatus.textContent = "等待你的第一个任务";
        elements.focusPrefix.textContent = "现在可以先做";
        elements.currentTaskTitle.textContent = "添加第一个任务";
        elements.currentTaskMeta.innerHTML = [
          metaChip(icons.clock, "预计耗时 5 分钟"),
          metaChip(icons.calendar, "设置截止时间后可智能排序"),
          metaChip(icons.pin, "数据只保存在本地")
        ].join("");
      }

      elements.skipTaskButton.disabled = true;
      elements.completeCurrentButton.disabled = true;
      elements.completeCurrentButton.textContent = "标记完成";
      return;
    }

    if (item.type === "course") {
      const isActive = item.state === "active";
      elements.focusStatus.textContent = isActive
        ? `固定课表优先 · ${formatDuration(Math.max(1, Math.round((item.end - now.getTime()) / 60000)))}后结束`
        : `下一项安排 · ${formatDayTime(item.start, now)}`;
      elements.focusPrefix.textContent = isActive ? "当前你应该做" : "接下来你应该做";
      elements.currentTaskTitle.textContent = item.course.name;
      elements.currentTaskMeta.innerHTML = [
        metaChip(icons.clock, `${item.course.start} - ${item.course.end}`),
        item.course.location ? metaChip(icons.pin, item.course.location) : "",
        metaChip(icons.calendar, isActive ? "正在上课，已自动置顶" : formatAbsolute(item.start))
      ].filter(Boolean).join("");
      elements.skipTaskButton.disabled = !isActive;
      elements.completeCurrentButton.disabled = true;
      elements.completeCurrentButton.textContent = isActive ? "课程进行中" : "尚未开始";
    } else {
      const urgency = getDeadlineInfo(item.task.deadline, now);
      elements.focusStatus.textContent = `当前优先 · ${IMPORTANCE[item.task.importance].description}`;
      elements.focusPrefix.textContent = "当前你应该做";
      elements.currentTaskTitle.textContent = item.task.name;
      elements.currentTaskMeta.innerHTML = [
        metaChip(icons.clock, `预计 ${formatDuration(item.task.duration)}`),
        metaChip(icons.calendar, item.task.deadline ? `${urgency.overdue ? "已逾期" : "截止"} ${formatAbsolute(item.task.deadline)}` : "未设置截止时间"),
        item.task.deadline ? metaChip(icons.clock, urgency.text) : "",
        isTaskLowered(item.task, now) ? metaChip(icons.down, "已临时降低优先级") : ""
      ].filter(Boolean).join("");
      elements.skipTaskButton.disabled = false;
      elements.completeCurrentButton.disabled = false;
      elements.completeCurrentButton.textContent = "标记完成";
    }

    if (titleChanged && elements.currentTaskTitle.textContent) {
      elements.currentTaskTitle.animate(
        [
          { opacity: 0.35, transform: "translateY(10px)" },
          { opacity: 1, transform: "translateY(0)" }
        ],
        { duration: 330, easing: "cubic-bezier(.2,.85,.2,1)" }
      );
    }
  }

  function metaChip(icon, text) {
    return `<span class="meta-chip">${icon}<span>${escapeHtml(text)}</span></span>`;
  }

  function renderUpNext(queueItems, focus, now) {
    const focusKey = getItemKey(focus);
    const items = queueItems.filter((item) => getItemKey(item) !== focusKey).slice(0, 3);

    if (!items.length) {
      elements.upNextList.innerHTML = '<li class="up-next-empty"><span>队列中没有其他待办</span></li>';
      return;
    }

    elements.upNextList.innerHTML = items.map((item, index) => {
      const title = item.type === "course" ? item.course.name : item.task.name;
      const label = item.type === "course"
        ? `${item.course.start} - ${item.course.end}`
        : item.task.deadline
          ? getDeadlineInfo(item.task.deadline, now).text
          : `${IMPORTANCE[item.task.importance].label}优先级`;
      const badge = item.type === "course" ? "课表" : `第 ${index + 2} 位`;

      return `
        <li>
          <span>${index + 1}</span>
          <div>
            <strong title="${escapeHtml(title)}">${escapeHtml(title)}</strong>
            <small>${escapeHtml(label)}</small>
          </div>
          <em>${badge}</em>
        </li>
      `;
    }).join("");
  }

  function renderTasks(queueItems, focus, now) {
    if (!queueItems.length) {
      elements.taskList.innerHTML = `
        <div class="empty-state">
          <div>
            <div class="empty-illustration" aria-hidden="true"></div>
            <strong>任务队列还是空的</strong>
            <p>添加一项任务，或先录入每周固定的课程，此刻会自动帮你判断下一件事。</p>
          </div>
        </div>
      `;
      return;
    }

    const focusKey = getItemKey(focus);
    elements.taskList.innerHTML = queueItems.map((item, index) => {
      if (item.type === "course") return renderCourseQueueItem(item, index);
      return renderTaskQueueItem(item, index, focusKey, now);
    }).join("");
  }

  function renderCourseQueueItem(item) {
    const isActive = item.state === "active";
    return `
      <article class="task-item is-course" data-type="course" data-id="${escapeHtml(item.course.id)}">
        <span class="task-check course-check" aria-hidden="true">${isActive ? icons.play : icons.calendar}</span>
        <div class="task-body">
          <div class="task-title-line">
            <span class="rank-badge is-first">${isActive ? "进行中" : "课表"}</span>
            <h3 title="${escapeHtml(item.course.name)}">${escapeHtml(item.course.name)}</h3>
          </div>
          <div class="task-tags">
            <span class="tag">${icons.clock}${escapeHtml(`${item.course.start} - ${item.course.end}`)}</span>
            ${item.course.location ? `<span class="tag">${icons.pin}${escapeHtml(item.course.location)}</span>` : ""}
            <span class="tag ${isActive ? "is-urgent" : ""}">${isActive ? "固定课表已置顶" : "即将开始"}</span>
          </div>
        </div>
        <div class="task-actions">
          <button class="icon-button" type="button" data-action="edit-course" data-id="${escapeHtml(item.course.id)}" aria-label="编辑课程">${icons.edit}</button>
          <button class="icon-button danger" type="button" data-action="delete-course" data-id="${escapeHtml(item.course.id)}" aria-label="删除课程">${icons.trash}</button>
        </div>
      </article>
    `;
  }

  function renderTaskQueueItem(item, index, focusKey, now) {
    const task = item.task;
    const deadline = getDeadlineInfo(task.deadline, now);
    const lowered = isTaskLowered(task, now);
    const isCurrent = getItemKey(item) === focusKey;
    const importance = IMPORTANCE[task.importance];

    return `
      <article class="task-item ${isCurrent ? "is-current" : ""}" data-type="task" data-id="${escapeHtml(task.id)}" style="--importance-color: ${getImportanceColor(task.importance)}">
        <button class="task-check" type="button" data-action="complete-task" data-id="${escapeHtml(task.id)}" aria-label="完成任务：${escapeHtml(task.name)}">${icons.check}</button>
        <div class="task-body">
          <div class="task-title-line">
            <span class="rank-badge ${index === 0 ? "is-first" : ""}">${isCurrent ? "当前" : `第 ${index + 1} 位`}</span>
            <h3 title="${escapeHtml(task.name)}">${escapeHtml(task.name)}</h3>
          </div>
          <div class="task-tags">
            <span class="tag importance-${task.importance}">${importance.label}级 · ${importance.description}</span>
            <span class="tag ${deadline.overdue ? "is-overdue" : deadline.urgent ? "is-urgent" : ""}">${icons.calendar}${escapeHtml(deadline.hasDeadline ? `${deadline.overdue ? "已逾期" : "截止"} ${formatAbsolute(task.deadline)}` : "无截止时间")}</span>
            <span class="tag">${icons.clock}${escapeHtml(formatDuration(task.duration))}</span>
            ${lowered ? `<span class="tag is-lowered">${icons.down}临时降级至 ${formatTime(task.loweredUntil)}</span>` : ""}
          </div>
        </div>
        <div class="task-actions">
          <button class="icon-button ${lowered ? "active" : ""}" type="button" data-action="lower-task" data-id="${escapeHtml(task.id)}" aria-label="${lowered ? "恢复原优先级" : "临时降低优先级"}" title="${lowered ? "恢复原优先级" : "临时降低 2 小时"}">${icons.down}</button>
          <button class="icon-button" type="button" data-action="edit-task" data-id="${escapeHtml(task.id)}" aria-label="编辑任务">${icons.edit}</button>
          <button class="icon-button danger" type="button" data-action="delete-task" data-id="${escapeHtml(task.id)}" aria-label="删除任务">${icons.trash}</button>
        </div>
      </article>
    `;
  }

  function renderSchedule(now) {
    const courses = [...state.courses].sort(compareCourses);
    elements.scheduleCount.textContent = `${courses.length} 节`;

    if (!courses.length) {
      elements.scheduleList.innerHTML = `
        <div class="empty-state compact">
          <p>还没有固定课程。添加后，每周同一时间会自动置顶。</p>
        </div>
      `;
      return;
    }

    const grouped = new Map();
    courses.forEach((course) => {
      if (!grouped.has(course.weekday)) grouped.set(course.weekday, []);
      grouped.get(course.weekday).push(course);
    });

    elements.scheduleList.innerHTML = WEEKDAY_ORDER
      .filter((weekday) => grouped.has(weekday))
      .map((weekday) => {
        const items = grouped.get(weekday).map((course) => {
          const active = isCourseActive(course, now);
          return `
            <div class="schedule-item ${active ? "is-active" : ""}">
              <span class="schedule-time">${escapeHtml(course.start)}<br>${escapeHtml(course.end)}</span>
              <div class="schedule-info">
                <strong title="${escapeHtml(course.name)}">${escapeHtml(course.name)}</strong>
                <small>${course.location ? escapeHtml(course.location) : "未填写地点"}${active ? " · 正在上课" : ""}</small>
              </div>
              <div class="schedule-actions">
                <button class="icon-button" type="button" data-action="edit-course" data-id="${escapeHtml(course.id)}" aria-label="编辑课程">${icons.edit}</button>
                <button class="icon-button danger" type="button" data-action="delete-course" data-id="${escapeHtml(course.id)}" aria-label="删除课程">${icons.trash}</button>
              </div>
            </div>
          `;
        }).join("");

        return `
          <div class="schedule-day">
            <div class="schedule-day-label">${WEEKDAYS[weekday]}${weekday === now.getDay() ? " · 今天" : ""}</div>
            ${items}
          </div>
        `;
      }).join("");
  }

  function renderStats(now) {
    const pending = state.tasks.length;
    const todayCompleted = state.completed.filter((entry) => isSameDay(entry.completedAt, now)).length;
    const dueTodayPending = state.tasks.filter((task) => task.deadline && isSameDay(task.deadline, now)).length;
    const denominator = todayCompleted + dueTodayPending;
    const percent = denominator > 0
      ? Math.round((todayCompleted / denominator) * 100)
      : pending === 0 && todayCompleted > 0
        ? 100
        : 0;

    elements.pendingCount.textContent = String(pending);
    elements.todayDoneCount.textContent = String(todayCompleted);
    elements.progressValue.textContent = `${percent}%`;
    elements.progressBar.style.width = `${percent}%`;
  }

  function renderNotice(focus, now) {
    if (state.noticeOverride && Date.now() < state.noticeOverrideUntil) {
      elements.noticeText.textContent = state.noticeOverride;
      return;
    }

    state.noticeOverride = "";

    if (!state.tasks.length && !state.courses.length) {
      elements.noticeText.textContent = "添加任务或课程后，我会根据时间、截止日期和重要等级自动推荐。";
      return;
    }

    if (!focus) {
      elements.noticeText.textContent = state.tasks.length
        ? "当前任务都已跳过或完成。你也可以撤销跳过，重新回到任务队列。"
        : "今天没有安排任务，下一节固定课程会自动出现在顶部。";
      return;
    }

    if (focus.type === "course") {
      elements.noticeText.textContent = focus.state === "active"
        ? `“${focus.course.name}”正在进行，固定课表已自动置顶。`
        : `下一项安排是“${focus.course.name}”，将在 ${formatDayTime(focus.start, now)} 开始。`;
      return;
    }

    const deadline = getDeadlineInfo(focus.task.deadline, now);
    if (deadline.overdue) {
      elements.noticeText.textContent = `“${focus.task.name}”已经逾期，系统将它排在最前面。`;
    } else if (deadline.hasDeadline && deadline.remainingMs <= 3 * HOUR) {
      elements.noticeText.textContent = `“${focus.task.name}”${deadline.text}，截止时间最近，因此优先推荐。`;
    } else if (!deadline.hasDeadline) {
      elements.noticeText.textContent = `“${focus.task.name}”是当前重要等级最高的无截止时间任务。`;
    } else {
      elements.noticeText.textContent = `系统已按固定课表、截止时间和重要等级排序，当前推荐“${focus.task.name}”。`;
    }
  }

  function getRankedCandidates(now) {
    const activeCourses = state.courses
      .filter((course) => isCourseActive(course, now))
      .map((course) => buildCourseItem(course, now, "active"))
      .filter((item) => !state.skipped.has(item.key))
      .sort((a, b) => a.start - b.start);

    const tasks = state.tasks
      .filter((task) => !state.skipped.has(task.id))
      .map((task) => ({ type: "task", task, key: task.id }))
      .sort((a, b) => compareTasks(a.task, b.task, now));

    return [...activeCourses, ...tasks];
  }

  function getCurrentItem(now) {
    const candidates = getRankedCandidates(now);
    if (candidates.length) return candidates[0];
    return getNextCourseItem(now);
  }

  function getNextCourseItem(now) {
    const next = findNextCourse(now);
    if (!next || next.start - now.getTime() > DAY * 2) return null;
    return buildCourseItem(next.course, now, "next", next.start, next.end);
  }

  function findNextCourse(now) {
    let nearest = null;

    state.courses.forEach((course) => {
      for (let offset = 0; offset < 8; offset += 1) {
        const date = new Date(now);
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() + offset);
        if (date.getDay() !== course.weekday) continue;

        const start = dateAtTime(date, course.start);
        const end = dateAtTime(date, course.end);
        if (start <= now.getTime()) continue;

        if (!nearest || start < nearest.start) nearest = { course, start, end };
        break;
      }
    });

    return nearest;
  }

  function buildCourseItem(course, now, itemState, explicitStart, explicitEnd) {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const start = explicitStart ?? dateAtTime(today, course.start);
    const end = explicitEnd ?? dateAtTime(today, course.end);
    return {
      type: "course",
      course,
      state: itemState,
      start,
      end,
      key: itemState === "active" ? courseOccurrenceKey(course, now) : `next:${course.id}`
    };
  }

  function compareTasks(a, b, now) {
    const aHasDeadline = Number.isFinite(a.deadline);
    const bHasDeadline = Number.isFinite(b.deadline);

    if (aHasDeadline !== bHasDeadline) return aHasDeadline ? -1 : 1;

    if (aHasDeadline) {
      const aEffective = a.deadline + (isTaskLowered(a, now) ? 8 * HOUR : 0);
      const bEffective = b.deadline + (isTaskLowered(b, now) ? 8 * HOUR : 0);
      if (aEffective !== bEffective) return aEffective - bEffective;
    }

    const importanceDiff = IMPORTANCE[a.importance].rank - IMPORTANCE[b.importance].rank;
    if (importanceDiff !== 0) return importanceDiff;

    return (a.createdAt || 0) - (b.createdAt || 0);
  }

  function compareCourses(a, b) {
    const dayDiff = WEEKDAY_ORDER.indexOf(a.weekday) - WEEKDAY_ORDER.indexOf(b.weekday);
    if (dayDiff !== 0) return dayDiff;
    return timeToMinutes(a.start) - timeToMinutes(b.start);
  }

  function handleTaskSubmit(event) {
    event.preventDefault();
    elements.taskFormError.textContent = "";

    const name = elements.taskName.value.trim();
    const importance = elements.taskImportance.value;
    const duration = Number(elements.taskDuration.value);
    const deadlineValue = elements.taskDeadline.value;

    if (!name) {
      elements.taskFormError.textContent = "请输入任务名称。";
      elements.taskName.focus();
      return;
    }

    if (!IMPORTANCE[importance] || !Number.isFinite(duration) || duration < 5 || duration > 1440) {
      elements.taskFormError.textContent = "预计时长需要在 5 到 1440 分钟之间。";
      elements.taskDuration.focus();
      return;
    }

    const deadline = deadlineValue ? new Date(deadlineValue).getTime() : null;
    if (deadlineValue && !Number.isFinite(deadline)) {
      elements.taskFormError.textContent = "截止时间格式不正确。";
      return;
    }

    if (state.editingTaskId) {
      const index = state.tasks.findIndex((task) => task.id === state.editingTaskId);
      if (index >= 0) {
        state.tasks[index] = {
          ...state.tasks[index],
          name,
          importance,
          duration,
          deadline,
          updatedAt: Date.now()
        };
        setNotice(`已更新“${name}”，任务队列已重新排序。`);
        showToast("任务已更新，优先级已重新计算。", "success");
      }
      resetTaskForm();
    } else {
      state.tasks.push({
        id: createId("task"),
        name,
        importance,
        duration,
        deadline,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        loweredUntil: null
      });
      resetTaskForm();
      setNotice(`已添加“${name}”，系统已把它放入最合适的位置。`);
      showToast("任务已加入队列。", "success");
    }

    saveTasks();
    renderAll();
  }

  function handleScheduleSubmit(event) {
    event.preventDefault();
    elements.scheduleFormError.textContent = "";

    const name = elements.courseName.value.trim();
    const weekday = Number(elements.courseWeekday.value);
    const start = elements.courseStart.value;
    const end = elements.courseEnd.value;
    const location = elements.courseLocation.value.trim();

    if (!name) {
      elements.scheduleFormError.textContent = "请输入课程名称。";
      elements.courseName.focus();
      return;
    }

    if (!start || !end || timeToMinutes(start) >= timeToMinutes(end)) {
      elements.scheduleFormError.textContent = "结束时间需要晚于开始时间。";
      elements.courseEnd.focus();
      return;
    }

    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      elements.scheduleFormError.textContent = "请选择正确的星期。";
      return;
    }

    const payload = { name, weekday, start, end, location };

    if (state.editingCourseId) {
      const index = state.courses.findIndex((course) => course.id === state.editingCourseId);
      if (index >= 0) {
        state.courses[index] = { ...state.courses[index], ...payload, updatedAt: Date.now() };
        setNotice(`已更新“${name}”的固定课表，到上课时间会自动置顶。`);
        showToast("课程已更新。", "success");
      }
      resetScheduleForm();
    } else {
      state.courses.push({
        id: createId("course"),
        ...payload,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      resetScheduleForm();
      setNotice(`已加入每周课程“${name}”，上课时会自动成为最高优先级。`);
      showToast("课程已加入每周课表。", "success");
    }

    saveCourses();
    renderAll();
  }

  function handleTaskListClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;

    if (action === "complete-task") {
      const row = button.closest(".task-item");
      if (row) row.classList.add("is-completing");
      window.setTimeout(() => completeTask(id), 190);
      return;
    }

    if (action === "edit-task") return beginTaskEdit(id);
    if (action === "delete-task") return deleteTask(id);
    if (action === "lower-task") return toggleTaskPriority(id);

    if (action === "edit-course") {
      activateTab("schedule");
      beginCourseEdit(id);
      return;
    }

    if (action === "delete-course") deleteCourse(id);
  }

  function handleScheduleListClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    if (button.dataset.action === "edit-course") {
      beginCourseEdit(button.dataset.id);
    } else if (button.dataset.action === "delete-course") {
      deleteCourse(button.dataset.id);
    }
  }

  function completeTask(id) {
    const index = state.tasks.findIndex((task) => task.id === id);
    if (index < 0) return;

    const [task] = state.tasks.splice(index, 1);
    state.completed.push({
      id: createId("done"),
      taskId: task.id,
      name: task.name,
      importance: task.importance,
      duration: task.duration,
      deadline: task.deadline,
      completedAt: Date.now()
    });

    state.skipped.delete(task.id);
    saveTasks();
    saveCompleted();
    setNotice(`已完成“${task.name}”，它已从任务队列移除。`);
    showToast("完成一项，队列已自动更新。", "success");
    renderAll();
  }

  function completeCurrent() {
    const current = getCurrentItem(new Date());
    if (!current || current.type !== "task") return;
    completeTask(current.task.id);
  }

  function skipCurrent() {
    const now = new Date();
    const current = getCurrentItem(now);
    if (!current || (current.type === "course" && current.state !== "active")) return;

    const key = current.type === "task" ? current.task.id : current.key;
    const title = current.type === "task" ? current.task.name : current.course.name;
    state.skipped.add(key);
    state.lastSkipKey = key;
    saveSkipped();

    const next = getCurrentItem(now);
    if (next && getItemKey(next) !== key) {
      if (next.type === "task") {
        setNotice(`已跳过“${title}”，为你推荐下一个优先级最高的“${next.task.name}”，${getDeadlineInfo(next.task.deadline, now).shortText}`);
      } else {
        setNotice(`已跳过“${title}”，接下来的固定课程是“${next.course.name}”。`);
      }
      showToast("已切换任务，优先级已重新计算。", "warning");
    } else {
      setNotice(`已跳过“${title}”，当前没有其他待办。可点击“撤销刚才的跳过”恢复。`);
      showToast("暂时没有可推荐的其他任务。", "warning");
    }

    renderAll(now);
  }

  function undoSkip() {
    if (!state.lastSkipKey) return;
    state.skipped.delete(state.lastSkipKey);
    state.lastSkipKey = null;
    saveSkipped();
    setNotice("已撤销跳过，任务重新参与智能排序。");
    showToast("已恢复刚才跳过的任务。", "success");
    renderAll();
  }

  function toggleTaskPriority(id) {
    const task = state.tasks.find((item) => item.id === id);
    if (!task) return;

    const lowered = isTaskLowered(task, new Date());
    task.loweredUntil = lowered ? null : Date.now() + 2 * HOUR;
    task.updatedAt = Date.now();
    saveTasks();

    if (lowered) {
      setNotice(`已恢复“${task.name}”的原始优先级。`);
      showToast("任务优先级已恢复。", "success");
    } else {
      setNotice(`已临时降低“${task.name}”的优先级 2 小时，队列已重新排序。`);
      showToast("已临时降低优先级，2 小时后自动恢复。", "warning");
    }

    renderAll();
  }

  function deleteTask(id) {
    const task = state.tasks.find((item) => item.id === id);
    if (!task) return;
    if (!window.confirm(`确定删除任务“${task.name}”吗？`)) return;

    state.tasks = state.tasks.filter((item) => item.id !== id);
    state.skipped.delete(id);
    saveTasks();
    saveSkipped();
    setNotice(`已删除“${task.name}”。`);
    showToast("任务已删除。");
    renderAll();
  }

  function deleteCourse(id) {
    const course = state.courses.find((item) => item.id === id);
    if (!course) return;
    if (!window.confirm(`确定删除课程“${course.name}”吗？`)) return;

    state.courses = state.courses.filter((item) => item.id !== id);
    saveCourses();
    setNotice(`已从每周课表中删除“${course.name}”。`);
    showToast("课程已删除。");
    renderAll();
  }

  function beginTaskEdit(id) {
    const task = state.tasks.find((item) => item.id === id);
    if (!task) return;

    activateTab("task");
    state.editingTaskId = id;
    elements.taskName.value = task.name;
    elements.taskImportance.value = task.importance;
    elements.taskDuration.value = String(task.duration);
    elements.taskDeadline.value = task.deadline ? toDateTimeLocal(task.deadline) : "";
    elements.taskFormTitle.textContent = "编辑任务";
    elements.taskFormHint.textContent = "修改后会立即重新计算优先顺序。";
    elements.taskSubmitLabel.textContent = "保存修改";
    elements.cancelTaskEditButton.hidden = false;
    elements.taskName.focus();
    elements.taskFormPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetTaskForm() {
    state.editingTaskId = null;
    elements.taskForm.reset();
    elements.taskImportance.value = "medium";
    elements.taskDuration.value = "60";
    elements.taskFormError.textContent = "";
    elements.taskFormTitle.textContent = "新建任务";
    elements.taskFormHint.textContent = "输入关键信息，系统会自动判断优先顺序。";
    elements.taskSubmitLabel.textContent = "加入任务队列";
    elements.cancelTaskEditButton.hidden = true;
  }

  function beginCourseEdit(id) {
    const course = state.courses.find((item) => item.id === id);
    if (!course) return;

    activateTab("schedule");
    state.editingCourseId = id;
    elements.courseName.value = course.name;
    elements.courseWeekday.value = String(course.weekday);
    elements.courseStart.value = course.start;
    elements.courseEnd.value = course.end;
    elements.courseLocation.value = course.location || "";
    elements.scheduleFormTitle.textContent = "编辑固定课程";
    elements.scheduleFormHint.textContent = "按周生效，保存后自动更新。";
    elements.scheduleSubmitLabel.textContent = "保存课程修改";
    elements.cancelScheduleEditButton.hidden = false;
    elements.courseName.focus();
    elements.scheduleFormPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetScheduleForm() {
    state.editingCourseId = null;
    elements.scheduleForm.reset();
    elements.courseStart.value = "08:00";
    elements.courseEnd.value = "09:40";
    elements.scheduleFormError.textContent = "";
    elements.scheduleFormTitle.textContent = "添加固定课程";
    elements.scheduleFormHint.textContent = "按周循环，到上课时间自动置顶。";
    elements.scheduleSubmitLabel.textContent = "保存到每周课表";
    elements.cancelScheduleEditButton.hidden = true;
  }

  function activateTab(tab) {
    const showTask = tab === "task";
    elements.taskTab.classList.toggle("is-active", showTask);
    elements.scheduleTab.classList.toggle("is-active", !showTask);
    elements.taskTab.setAttribute("aria-selected", String(showTask));
    elements.scheduleTab.setAttribute("aria-selected", String(!showTask));
    elements.taskFormPanel.hidden = !showTask;
    elements.scheduleFormPanel.hidden = showTask;
  }

  function clearCompleted() {
    if (!state.completed.length) {
      showToast("还没有完成记录。");
      return;
    }

    if (!window.confirm("确定清空所有任务完成记录吗？此操作无法撤销。")) return;
    state.completed = [];
    saveCompleted();
    renderStats();
    setNotice("完成记录已清空，本地任务数据不受影响。");
    showToast("完成记录已清空。", "success");
  }

  function isCourseActive(course, now) {
    if (course.weekday !== now.getDay()) return false;
    const start = dateAtTime(now, course.start);
    const end = dateAtTime(now, course.end);
    const timestamp = now.getTime();
    return timestamp >= start && timestamp < end;
  }

  function isTaskLowered(task, now) {
    return Number.isFinite(task.loweredUntil) && task.loweredUntil > now.getTime();
  }

  function getDeadlineInfo(deadline, now = new Date()) {
    if (!Number.isFinite(deadline)) {
      return { hasDeadline: false, overdue: false, urgent: false, text: "无截止时间", shortText: "没有设置截止时间", remainingMs: Infinity };
    }

    const remainingMs = deadline - now.getTime();
    const overdue = remainingMs < 0;
    const absolute = Math.abs(remainingMs);
    const readable = formatDuration(Math.max(1, Math.round(absolute / 60000)));

    return {
      hasDeadline: true,
      overdue,
      urgent: !overdue && remainingMs <= 3 * HOUR,
      remainingMs,
      text: overdue ? `已逾期 ${readable}` : `还剩 ${readable}`,
      shortText: overdue ? `已经逾期 ${readable}` : `截止时间还有 ${readable}`
    };
  }

  function formatDuration(minutes) {
    const value = Math.max(1, Math.round(minutes));
    if (value < 60) return `${value} 分钟`;
    const hours = Math.floor(value / 60);
    const rest = value % 60;
    if (hours < 24) return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
    const days = Math.floor(hours / 24);
    const restHours = hours % 24;
    return restHours ? `${days} 天 ${restHours} 小时` : `${days} 天`;
  }

  function formatAbsolute(timestamp) {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false
    }).format(new Date(timestamp));
  }

  function formatDayTime(timestamp, now = new Date()) {
    const target = new Date(timestamp);
    const sameDay = isSameDay(timestamp, now);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayLabel = sameDay ? "今天" : isSameDay(timestamp, tomorrow) ? "明天" : `周${"日一二三四五六"[target.getDay()]}`;
    return `${dayLabel} ${formatTime(timestamp)}`;
  }

  function formatTime(timestamp) {
    return new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit", minute: "2-digit", hour12: false
    }).format(new Date(timestamp));
  }

  function getImportanceColor(importance) {
    if (importance === "high") return "#ff7185";
    if (importance === "low") return "#65a7ff";
    return "#ffc15f";
  }

  function getItemKey(item) {
    if (!item) return "";
    return item.type === "course" ? item.key : item.task.id;
  }

  function timeToMinutes(value) {
    const [hours, minutes] = String(value).split(":").map(Number);
    return hours * 60 + minutes;
  }

  function dateAtTime(dateLike, time) {
    const date = new Date(dateLike);
    const minutes = timeToMinutes(time);
    date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return date.getTime();
  }

  function getDateKey(dateLike) {
    const date = new Date(dateLike);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  }

  function isSameDay(timestamp, dateLike) {
    const a = new Date(timestamp);
    const b = new Date(dateLike);
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function toDateTimeLocal(timestamp) {
    const date = new Date(timestamp);
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(timestamp - offset).toISOString().slice(0, 16);
  }

  function courseOccurrenceKey(course, dateLike) {
    return `course:${course.id}:${getDateKey(dateLike)}`;
  }

  function ensureSkippedDate(now) {
    const today = getDateKey(now);
    if (state.skippedDate !== today) {
      state.skippedDate = today;
      state.skipped.clear();
      state.lastSkipKey = null;
      saveSkipped();
    }
  }

  function setNotice(message) {
    state.noticeOverride = message;
    state.noticeOverrideUntil = Date.now() + 30000;
    elements.noticeText.textContent = message;
  }

  function showToast(message, type = "") {
    const toast = document.createElement("div");
    toast.className = `toast ${type ? `is-${type}` : ""}`.trim();
    toast.textContent = message;
    elements.toastRegion.appendChild(toast);

    window.setTimeout(() => {
      toast.classList.add("is-leaving");
      window.setTimeout(() => toast.remove(), 240);
    }, 3600);
  }

  function saveTasks() {
    saveStorage(STORAGE.tasks, state.tasks);
  }

  function saveCourses() {
    saveStorage(STORAGE.courses, state.courses);
  }

  function saveCompleted() {
    saveStorage(STORAGE.completed, state.completed);
  }

  function saveSkipped() {
    saveStorage(STORAGE.skipped, { date: state.skippedDate, keys: [...state.skipped] });
  }

  function loadSkipped() {
    const value = loadStorage(STORAGE.skipped);
    if (!value || value.date !== getDateKey(new Date()) || !Array.isArray(value.keys)) return;
    state.skippedDate = value.date;
    state.skipped = new Set(value.keys.filter((key) => typeof key === "string"));
  }

  function loadArray(key) {
    const value = loadStorage(key);
    return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
  }

  function loadStorage(key) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn(`无法读取本地数据：${key}`, error);
      return null;
    }
  }

  function saveStorage(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`无法保存本地数据：${key}`, error);
      showToast("浏览器本地存储不可用，本次修改可能无法保留。", "warning");
    }
  }

  function createId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `${prefix}-${window.crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
