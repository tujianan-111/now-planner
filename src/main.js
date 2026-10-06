import "./styles.css";
import {
  claimScheduleShare,
  createScheduleShare,
  createWorkspace,
  getSession,
  isCloudConfigured,
  keyStrength,
  normalizeKey,
  recoverWorkspace,
  rotateWorkspaceKey,
  signInWithKey,
  signOut,
  supabase,
  validateKey
} from "./auth.js";
import { PlannerSync } from "./sync.js";
import {
  findNextCourseItem,
  getCourseWeekLabel,
  getCurrentItem,
  getRankedCandidates,
  isCourseActive,
  isTaskLowered
} from "./planner.js";
import {
  HOUR,
  IMPORTANCE,
  WEEKDAYS,
  createId,
  escapeHtml,
  formatAbsolute,
  formatDayTime,
  formatDuration,
  formatTime,
  getDeadlineInfo,
  getDateKey,
  isSameDay,
  timeToMinutes,
  toDateTimeLocal
} from "./utils.js";
import {
  clearNativeNotifications,
  hideNativeSplash,
  initNativeShell,
  isNativeApp,
  loadNotificationSettings,
  refreshNativeNotifications,
  requestNotificationPermission,
  saveNotificationSettings,
  updateNativeBadge
} from "./native.js";

const elements = {
  loadingScreen: document.getElementById("loadingScreen"),
  main: document.querySelector("main"),
  mobileDeckNav: document.getElementById("mobileDeckNav"),
  authScreen: document.getElementById("authScreen"),
  appShell: document.getElementById("appShell"),
  authLoginTab: document.getElementById("authLoginTab"),
  authCreateTab: document.getElementById("authCreateTab"),
  loginPanel: document.getElementById("loginPanel"),
  createPanel: document.getElementById("createPanel"),
  recoveryPanel: document.getElementById("recoveryPanel"),
  recoveryResultPanel: document.getElementById("recoveryResultPanel"),
  loginForm: document.getElementById("loginForm"),
  loginKey: document.getElementById("loginKey"),
  loginError: document.getElementById("loginError"),
  loginSubmitButton: document.getElementById("loginSubmitButton"),
  createForm: document.getElementById("createForm"),
  createKey: document.getElementById("createKey"),
  createKeyConfirm: document.getElementById("createKeyConfirm"),
  createError: document.getElementById("createError"),
  createSubmitButton: document.getElementById("createSubmitButton"),
  recoveryAcknowledge: document.getElementById("recoveryAcknowledge"),
  keyStrengthBar: document.getElementById("keyStrengthBar"),
  keyStrengthLabel: document.getElementById("keyStrengthLabel"),
  showRecoveryButton: document.getElementById("showRecoveryButton"),
  previewModeButton: document.getElementById("previewModeButton"),
  recoveryForm: document.getElementById("recoveryForm"),
  recoveryCode: document.getElementById("recoveryCode"),
  recoveryNewKey: document.getElementById("recoveryNewKey"),
  recoveryNewKeyConfirm: document.getElementById("recoveryNewKeyConfirm"),
  recoveryError: document.getElementById("recoveryError"),
  recoverySubmitButton: document.getElementById("recoverySubmitButton"),
  backToLoginButton: document.getElementById("backToLoginButton"),
  recoveryCodeOutput: document.getElementById("recoveryCodeOutput"),
  copyRecoveryCodeButton: document.getElementById("copyRecoveryCodeButton"),
  recoverySavedCheck: document.getElementById("recoverySavedCheck"),
  finishCreateButton: document.getElementById("finishCreateButton"),
  liveDate: document.getElementById("liveDate"),
  liveTime: document.getElementById("liveTime"),
  workspaceLabel: document.getElementById("workspaceLabel"),
  syncStatusButton: document.getElementById("syncStatusButton"),
  syncStatusDot: document.getElementById("syncStatusDot"),
  syncStatusText: document.getElementById("syncStatusText"),
  focusStatus: document.getElementById("focusStatus"),
  focusPrefix: document.getElementById("focusPrefix"),
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
  taskSubmitButton: document.getElementById("taskSubmitButton"),
  cancelTaskEditButton: document.getElementById("cancelTaskEditButton"),
  scheduleForm: document.getElementById("scheduleForm"),
  scheduleFormTitle: document.getElementById("scheduleFormTitle"),
  scheduleFormHint: document.getElementById("scheduleFormHint"),
  courseName: document.getElementById("courseName"),
  courseWeekday: document.getElementById("courseWeekday"),
  courseStart: document.getElementById("courseStart"),
  courseEnd: document.getElementById("courseEnd"),
  courseLocation: document.getElementById("courseLocation"),
  courseTeacher: document.getElementById("courseTeacher"),
  scheduleFormError: document.getElementById("scheduleFormError"),
  scheduleSubmitButton: document.getElementById("scheduleSubmitButton"),
  cancelScheduleEditButton: document.getElementById("cancelScheduleEditButton"),
  scheduleList: document.getElementById("scheduleList"),
  scheduleCount: document.getElementById("scheduleCount"),
  shareScheduleButton: document.getElementById("shareScheduleButton"),
  claimShareButton: document.getElementById("claimShareButton"),
  scheduleShareDialog: document.getElementById("scheduleShareDialog"),
  createShareCodeButton: document.getElementById("createShareCodeButton"),
  copyShareCodeButton: document.getElementById("copyShareCodeButton"),
  shareCodeOutput: document.getElementById("shareCodeOutput"),
  claimShareCodeButton: document.getElementById("claimShareCodeButton"),
  claimShareCodeInput: document.getElementById("claimShareCodeInput"),
  shareDialogError: document.getElementById("shareDialogError"),
  shareCreateTab: document.getElementById("shareCreateTab"),
  shareClaimTab: document.getElementById("shareClaimTab"),
  shareCreatePanel: document.getElementById("shareCreatePanel"),
  shareClaimPanel: document.getElementById("shareClaimPanel"),
  shareDivider: document.getElementById("shareDivider"),
  exportDataButton: document.getElementById("exportDataButton"),
  syncFootnote: document.getElementById("syncFootnote"),
  accountButton: document.getElementById("accountButton"),
  accountInitial: document.getElementById("accountInitial"),
  accountDialog: document.getElementById("accountDialog"),
  accountDialogTitle: document.getElementById("accountDialogTitle"),
  accountWorkspaceName: document.getElementById("accountWorkspaceName"),
  accountSyncDetail: document.getElementById("accountSyncDetail"),
  exportDataDialogButton: document.getElementById("exportDataDialogButton"),
  openRotateKeyButton: document.getElementById("openRotateKeyButton"),
  logoutButton: document.getElementById("logoutButton"),
  rotateKeyDialog: document.getElementById("rotateKeyDialog"),
  rotateKeyForm: document.getElementById("rotateKeyForm"),
  currentKeyInput: document.getElementById("currentKeyInput"),
  newKeyInput: document.getElementById("newKeyInput"),
  newKeyConfirmInput: document.getElementById("newKeyConfirmInput"),
  rotateKeyError: document.getElementById("rotateKeyError"),
  rotateKeySubmitButton: document.getElementById("rotateKeySubmitButton"),
  nativeSettingsPanel: document.getElementById("nativeSettingsPanel"),
  nativeNotificationsEnabled: document.getElementById("nativeNotificationsEnabled"),
  nativeTaskLeadMinutes: document.getElementById("nativeTaskLeadMinutes"),
  nativeCourseLeadMinutes: document.getElementById("nativeCourseLeadMinutes"),
  nativeBadgeEnabled: document.getElementById("nativeBadgeEnabled"),
  nativePermissionText: document.getElementById("nativePermissionText"),
  cancelRotateKeyButton: document.getElementById("cancelRotateKeyButton"),
  toastRegion: document.getElementById("toastRegion")
};

const state = {
  user: null,
  sync: null,
  data: { tasks: [], semesters: [], courses: [], completed: [], skipped: [] },
  syncState: { state: "syncing", text: "正在连接", lastSyncAt: null },
  editingTaskId: null,
  editingCourseId: null,
  rotationKeys: [],
  lastRotationKey: null,
  lastCurrentKey: null,
  noticeOverride: "",
  noticeOverrideUntil: 0,
  lastMinuteKey: "",
  pendingRecoveryCode: "",
  nativeSettings: null,
  nativeCleanup: null,
  nativeRefreshTimer: 0,
  started: false
};

bindEvents();
registerServiceWorker();
initialize();

async function initialize() {
  await initializeNativeShell();
  if (!isCloudConfigured) {
    elements.previewModeButton.hidden = false;
    showAuth();
    hideLoading();
    await hideNativeSplash();
    return;
  }

  try {
    const session = await getSession();
    if (session?.user) {
      const pendingRecovery = sessionStorage.getItem("now-planner.pending-recovery");
      if (pendingRecovery) {
        state.pendingRecoveryCode = pendingRecovery;
        elements.recoveryCodeOutput.textContent = pendingRecovery;
        showAuth();
        showAuthPanel("result");
        hideLoading();
        await hideNativeSplash();
      } else {
        await startWorkspace(session.user);
      }
    } else {
      showAuth();
      hideLoading();
      await hideNativeSplash();
    }
  } catch (error) {
    console.warn("读取登录状态失败", error);
    showAuth();
    hideLoading();
    await hideNativeSplash();
  }

  supabase?.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      state.sync?.destroy();
      state.started = false;
      showAuth();
    } else if (session?.user && !state.started) {
      startWorkspace(session.user);
    }
  });
}

function bindEvents() {
  elements.authLoginTab.addEventListener("click", () => showAuthPanel("login"));
  elements.authCreateTab.addEventListener("click", () => showAuthPanel("create"));
  elements.showRecoveryButton.addEventListener("click", () => showAuthPanel("recovery"));
  elements.backToLoginButton.addEventListener("click", () => showAuthPanel("login"));
  elements.previewModeButton.addEventListener("click", () => startWorkspace({ id: "preview", email: "本地预览" }, true));

  document.querySelectorAll("[data-reveal]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.reveal);
      if (!input) return;
      const visible = input.type === "text";
      input.type = visible ? "password" : "text";
      button.textContent = visible ? "显示" : "隐藏";
    });
  });

  elements.createKey.addEventListener("input", updateKeyStrength);
  elements.loginForm.addEventListener("submit", handleLogin);
  elements.createForm.addEventListener("submit", handleCreate);
  elements.recoveryForm.addEventListener("submit", handleRecovery);
  elements.finishCreateButton.addEventListener("click", finishCreate);
  elements.copyRecoveryCodeButton.addEventListener("click", copyRecoveryCode);
  elements.recoverySavedCheck.addEventListener("change", () => {
    elements.finishCreateButton.disabled = !elements.recoverySavedCheck.checked;
  });

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

  elements.syncStatusButton.addEventListener("click", () => {
    showToast(elements.syncFootnote.textContent || "同步状态正常。");
  });
  elements.accountButton.addEventListener("click", openAccountDialog);
  elements.exportDataButton.addEventListener("click", exportData);
  elements.exportDataDialogButton.addEventListener("click", exportData);
  elements.logoutButton.addEventListener("click", handleLogout);
  elements.openRotateKeyButton.addEventListener("click", openRotateKeyDialog);
  elements.shareScheduleButton.addEventListener("click", () => openScheduleShareDialog("create"));
  elements.claimShareButton.addEventListener("click", () => openScheduleShareDialog("claim"));
  elements.shareCreateTab.addEventListener("click", () => activateShareTab("create"));
  elements.shareClaimTab.addEventListener("click", () => activateShareTab("claim"));
  elements.createShareCodeButton.addEventListener("click", handleCreateShareCode);
  elements.copyShareCodeButton.addEventListener("click", copyShareCode);
  elements.claimShareCodeButton.addEventListener("click", handleClaimShareCode);
  elements.rotateKeyForm.addEventListener("submit", handleRotateKey);
  elements.cancelRotateKeyButton.addEventListener("click", () => elements.rotateKeyDialog.close());
  elements.nativeNotificationsEnabled.addEventListener("change", handleNativeNotificationToggle);
  elements.nativeTaskLeadMinutes.addEventListener("change", handleNativeLeadChange);
  elements.nativeCourseLeadMinutes.addEventListener("change", handleNativeLeadChange);
  elements.nativeBadgeEnabled.addEventListener("change", handleNativeBadgeToggle);

  window.addEventListener("online", () => state.sync?.flushOutbox().then(() => state.sync?.pullAll()));
  window.addEventListener("offline", () => updateSyncStatus({ state: "offline", text: "离线中" }));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) tick(true);
  });
  setupMobileDeck();
  window.setInterval(tick, 1000);
}

async function startWorkspace(user, preview = false) {
  if (state.started && state.user?.id === user.id) return;
  state.started = true;
  state.user = user;
  state.sync?.destroy();
  state.sync = new PlannerSync({
    supabase,
    userId: user.id,
    mode: preview || !isCloudConfigured ? "preview" : "cloud",
    onData: (data) => {
      state.data = data;
      renderAll();
      scheduleNativeIntegrationRefresh();
    },
    onStatus: updateSyncStatus
  });

  await state.sync.init();
  showApp();
  renderAll();
  updateClock();
  hideLoading();
  await refreshNativeIntegrations();
  await hideNativeSplash();
}

function showAuthPanel(panel) {
  const panels = {
    login: elements.loginPanel,
    create: elements.createPanel,
    recovery: elements.recoveryPanel,
    result: elements.recoveryResultPanel
  };
  Object.entries(panels).forEach(([name, element]) => {
    element.hidden = name !== panel;
  });
  elements.authLoginTab.classList.toggle("is-active", panel === "login");
  elements.authCreateTab.classList.toggle("is-active", panel === "create");
  elements.authLoginTab.setAttribute("aria-selected", String(panel === "login"));
  elements.authCreateTab.setAttribute("aria-selected", String(panel === "create"));
}

function showAuth() {
  elements.authScreen.hidden = false;
  elements.appShell.hidden = true;
  elements.loadingScreen.classList.add("is-hidden");
}

function showApp() {
  elements.authScreen.hidden = true;
  elements.appShell.hidden = false;
  updateWorkspaceIdentity();
}

function hideLoading() {
  elements.loadingScreen.classList.add("is-hidden");
}

function updateKeyStrength() {
  const result = keyStrength(elements.createKey.value);
  elements.keyStrengthBar.style.width = `${result.score * 25}%`;
  elements.keyStrengthBar.style.background = result.score <= 1 ? "#a85e55" : result.score === 2 ? "#b89555" : "#4e8062";
  elements.keyStrengthLabel.textContent = result.label;
}

async function handleLogin(event) {
  event.preventDefault();
  elements.loginError.textContent = "";
  const validation = validateKey(elements.loginKey.value);
  if (!validation.valid) {
    elements.loginError.textContent = validation.message;
    return;
  }

  setButtonBusy(elements.loginSubmitButton, true, "正在验证");
  try {
    const session = await signInWithKey(validation.key);
    await startWorkspace(session.user);
    elements.loginForm.reset();
  } catch (error) {
    elements.loginError.textContent = friendlyAuthError(error);
  } finally {
    setButtonBusy(elements.loginSubmitButton, false, "进入我的空间");
  }
}

async function handleCreate(event) {
  event.preventDefault();
  elements.createError.textContent = "";
  const validation = validateKey(elements.createKey.value);
  const confirmation = normalizeKey(elements.createKeyConfirm.value);

  if (!validation.valid) {
    elements.createError.textContent = validation.message;
    return;
  }
  if (validation.key !== confirmation) {
    elements.createError.textContent = "两次输入的密钥不一致。";
    return;
  }
  if (!elements.recoveryAcknowledge.checked) {
    elements.createError.textContent = "请先确认你了解恢复码的重要性。";
    return;
  }

  setButtonBusy(elements.createSubmitButton, true, "正在创建");
  try {
    const result = await createWorkspace(validation.key);
    state.pendingRecoveryCode = result.recoveryCode;
    sessionStorage.setItem("now-planner.pending-recovery", result.recoveryCode);
    elements.recoveryCodeOutput.textContent = result.recoveryCode;
    elements.recoverySavedCheck.checked = false;
    elements.finishCreateButton.disabled = true;
    showAuthPanel("result");
  } catch (error) {
    elements.createError.textContent = friendlyAuthError(error);
  } finally {
    setButtonBusy(elements.createSubmitButton, false, "生成我的空间");
  }
}

async function handleRecovery(event) {
  event.preventDefault();
  elements.recoveryError.textContent = "";
  const validation = validateKey(elements.recoveryNewKey.value);
  if (!elements.recoveryCode.value.trim()) {
    elements.recoveryError.textContent = "请输入一次性恢复码。";
    return;
  }
  if (!validation.valid) {
    elements.recoveryError.textContent = validation.message;
    return;
  }
  if (validation.key !== normalizeKey(elements.recoveryNewKeyConfirm.value)) {
    elements.recoveryError.textContent = "两次输入的新密钥不一致。";
    return;
  }

  setButtonBusy(elements.recoverySubmitButton, true, "正在验证");
  try {
    const result = await recoverWorkspace(elements.recoveryCode.value, validation.key);
    state.pendingRecoveryCode = result.recoveryCode;
    sessionStorage.setItem("now-planner.pending-recovery", result.recoveryCode);
    elements.recoveryCodeOutput.textContent = result.recoveryCode;
    elements.recoverySavedCheck.checked = false;
    elements.finishCreateButton.disabled = true;
    elements.recoveryForm.reset();
    showAuthPanel("result");
  } catch (error) {
    elements.recoveryError.textContent = friendlyAuthError(error);
  } finally {
    setButtonBusy(elements.recoverySubmitButton, false, "验证并重置");
  }
}

async function finishCreate() {
  if (!elements.recoverySavedCheck.checked) return;
  sessionStorage.removeItem("now-planner.pending-recovery");
  const session = await getSession();
  if (session?.user) await startWorkspace(session.user);
}

async function copyRecoveryCode() {
  try {
    await navigator.clipboard.writeText(state.pendingRecoveryCode || elements.recoveryCodeOutput.textContent);
    showToast("恢复码已复制。", "success");
  } catch {
    showToast("复制失败，请手动记录恢复码。", "warning");
  }
}

function friendlyAuthError(error) {
  const message = error?.message || "操作失败，请稍后重试。";
  if (/already registered|already exists|用户已存在/i.test(message)) return "这个密钥已经创建过空间，请切换到“输入密钥”。";
  if (/Invalid login credentials|invalid.*credentials/i.test(message)) return "密钥不正确，或该空间尚未创建。";
  if (/rate limit|too many/i.test(message)) return "操作过于频繁，请稍后再试。";
  return message;
}

function setButtonBusy(button, busy, text) {
  button.disabled = busy;
  button.textContent = text;
}

async function handleTaskSubmit(event) {
  event.preventDefault();
  elements.taskFormError.textContent = "";
  const name = elements.taskName.value.trim();
  const importance = elements.taskImportance.value;
  const durationMinutes = Number(elements.taskDuration.value);
  const deadlineValue = elements.taskDeadline.value;

  if (!name) {
    elements.taskFormError.textContent = "请输入任务名称。";
    return;
  }
  if (!IMPORTANCE[importance] || !Number.isFinite(durationMinutes) || durationMinutes < 5 || durationMinutes > 1440) {
    elements.taskFormError.textContent = "预计时长需要在 5 到 1440 分钟之间。";
    return;
  }
  const deadline = deadlineValue ? new Date(deadlineValue).toISOString() : null;
  const now = new Date().toISOString();

  if (state.editingTaskId) {
    const current = state.data.tasks.find((task) => task.id === state.editingTaskId);
    if (!current) return;
    await state.sync.mutate("tasks", "upsert", {
      ...current,
      name,
      importance,
      durationMinutes,
      deadline,
      updatedAt: now
    });
    setNotice(`已更新“${name}”，任务队列已重新排序。`);
    showToast("任务已更新。", "success");
    resetTaskForm();
  } else {
    await state.sync.mutate("tasks", "upsert", {
      id: createId("task"),
      name,
      importance,
      durationMinutes,
      deadline,
      loweredUntil: null,
      createdAt: now,
      updatedAt: now
    });
    setNotice(`已添加“${name}”，系统已把它放入最合适的位置。`);
    showToast("任务已加入队列。", "success");
    resetTaskForm();
  }
  renderAll();
}

async function handleScheduleSubmit(event) {
  event.preventDefault();
  elements.scheduleFormError.textContent = "";
  const name = elements.courseName.value.trim();
  const weekday = Number(elements.courseWeekday.value);
  const startTime = elements.courseStart.value;
  const endTime = elements.courseEnd.value;
  const location = elements.courseLocation.value.trim();
  const teacher = elements.courseTeacher.value.trim();

  if (!name) {
    elements.scheduleFormError.textContent = "请输入课程名称。";
    return;
  }
  if (!startTime || !endTime || timeToMinutes(startTime) >= timeToMinutes(endTime)) {
    elements.scheduleFormError.textContent = "结束时间需要晚于开始时间。";
    return;
  }

  const now = new Date().toISOString();
  if (state.editingCourseId) {
    const current = state.data.courses.find((course) => course.id === state.editingCourseId);
    if (!current) return;
    await state.sync.mutate("courses", "upsert", {
      ...current,
      name,
      weekday,
      startTime,
      endTime,
      location,
      teacher,
      updatedAt: now
    });
    setNotice(`已更新“${name}”的课表信息。`);
    showToast("课程已更新。", "success");
    resetScheduleForm();
  } else {
    await state.sync.mutate("courses", "upsert", {
      id: createId("course"),
      semesterId: null,
      name,
      weekday,
      startTime,
      endTime,
      location,
      teacher,
      credits: null,
      attribute: "",
      periods: "",
      weekNumbers: null,
      source: "manual",
      sourceKey: null,
      createdAt: now,
      updatedAt: now
    });
    setNotice(`已加入每周课程“${name}”。`);
    showToast("课程已加入课表。", "success");
    resetScheduleForm();
  }
  renderAll();
}

function handleTaskListClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;

  if (action === "complete-task") {
    const row = button.closest(".task-item");
    row?.classList.add("is-completing");
    window.setTimeout(() => completeTask(id), 180);
  } else if (action === "edit-task") {
    beginTaskEdit(id);
  } else if (action === "delete-task") {
    deleteTask(id);
  } else if (action === "lower-task") {
    toggleTaskPriority(id);
  } else if (action === "edit-course") {
    activateTab("schedule");
    beginCourseEdit(id);
  } else if (action === "delete-course") {
    deleteCourse(id);
  }
}

function handleScheduleListClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (button.dataset.action === "edit-course") beginCourseEdit(button.dataset.id);
  if (button.dataset.action === "delete-course") deleteCourse(button.dataset.id);
}

async function completeTask(id) {
  const task = state.data.tasks.find((item) => item.id === id);
  if (!task) return;
  const completedAt = new Date().toISOString();
  await state.sync.mutate("completed", "upsert", {
    id: createId("done"),
    taskId: task.id,
    name: task.name,
    importance: task.importance,
    durationMinutes: task.durationMinutes,
    completedAt,
    createdAt: completedAt,
    updatedAt: completedAt
  });
  await state.sync.mutate("tasks", "delete", { id: task.id, updatedAt: completedAt });
  state.rotationKeys = state.rotationKeys.filter((key) => key !== task.id);
  showToast("完成一项，队列已自动更新。", "success");
  renderAll();
}

function completeCurrent() {
  const current = getFocusItem(new Date());
  if (!current || current.type !== "task") return;
  completeTask(current.task.id);
}

async function skipCurrent() {
  const now = new Date();
  const ordered = getOrderedQueueItems(now);
  const current = ordered[0];
  if (!current || ordered.length < 2) {
    showToast("当前没有其他可以切换的安排。", "warning");
    return;
  }

  const key = getFocusKey(current);
  const title = current.type === "task" ? current.task.name : current.course.name;
  state.rotationKeys = [...state.rotationKeys.filter((item) => item !== key), key];
  state.lastRotationKey = key;

  const next = getOrderedQueueItems(now)[0];
  setNotice(next?.type === "task"
    ? `已将“${title}”放回待办，并切换到“${next.task.name}”。`
    : `已将“${title}”放回待办，并切换到“${next?.course?.name || "下一项安排"}”。`);
  showToast("已切换当前推荐，原任务仍在待办队列。", "success");
  renderAll();
}

async function undoSkip() {
  const key = state.lastRotationKey || state.rotationKeys.at(-1);
  if (!key) return;
  state.rotationKeys = state.rotationKeys.filter((item) => item !== key);
  state.lastRotationKey = null;
  setNotice("已将上一个任务放回优先位置。");
  showToast("上一个任务已放回前面。", "success");
  renderAll();
}

async function toggleTaskPriority(id) {
  const task = state.data.tasks.find((item) => item.id === id);
  if (!task) return;
  const lowered = isTaskLowered(task);
  const updatedAt = new Date().toISOString();
  await state.sync.mutate("tasks", "upsert", {
    ...task,
    loweredUntil: lowered ? null : new Date(Date.now() + 2 * HOUR).toISOString(),
    updatedAt
  });
  setNotice(lowered ? `已恢复“${task.name}”的原始优先级。` : `已临时降低“${task.name}”的优先级 2 小时。`);
  showToast(lowered ? "任务优先级已恢复。" : "已临时降低优先级。", lowered ? "success" : "warning");
  renderAll();
}

async function deleteTask(id) {
  const task = state.data.tasks.find((item) => item.id === id);
  if (!task || !window.confirm(`确定删除任务“${task.name}”吗？`)) return;
  await state.sync.mutate("tasks", "delete", { id, updatedAt: new Date().toISOString() });
  state.rotationKeys = state.rotationKeys.filter((key) => key !== id);
  setNotice(`已删除“${task.name}”。`);
  renderAll();
}

async function deleteCourse(id) {
  const course = state.data.courses.find((item) => item.id === id);
  if (!course || !window.confirm(`确定删除课程“${course.name}”吗？`)) return;
  await state.sync.mutate("courses", "delete", { id, updatedAt: new Date().toISOString() });
  state.rotationKeys = state.rotationKeys.filter((key) => !key.startsWith("course:" + id + ":"));
  setNotice(`已删除课程“${course.name}”。`);
  renderAll();
}

function beginTaskEdit(id) {
  const task = state.data.tasks.find((item) => item.id === id);
  if (!task) return;
  activateTab("task");
  state.editingTaskId = id;
  elements.taskName.value = task.name;
  elements.taskImportance.value = task.importance;
  elements.taskDuration.value = String(task.durationMinutes);
  elements.taskDeadline.value = task.deadline ? toDateTimeLocal(new Date(task.deadline).getTime()) : "";
  elements.taskFormTitle.textContent = "编辑任务";
  elements.taskFormHint.textContent = "修改后立即重新计算优先顺序。";
  elements.taskSubmitButton.textContent = "保存修改";
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
  elements.taskFormHint.textContent = "输入关键信息，系统会自动判断顺序。";
  elements.taskSubmitButton.textContent = "加入任务队列";
  elements.cancelTaskEditButton.hidden = true;
}

function beginCourseEdit(id) {
  const course = state.data.courses.find((item) => item.id === id);
  if (!course) return;
  activateTab("schedule");
  state.editingCourseId = id;
  elements.courseName.value = course.name;
  elements.courseWeekday.value = String(course.weekday);
  elements.courseStart.value = course.startTime;
  elements.courseEnd.value = course.endTime;
  elements.courseLocation.value = course.location || "";
  elements.courseTeacher.value = course.teacher || "";
  elements.scheduleFormTitle.textContent = "编辑课程";
  elements.scheduleFormHint.textContent = "手动修改会转为每周重复课程。";
  elements.scheduleSubmitButton.textContent = "保存课程修改";
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
  elements.scheduleFormHint.textContent = "手动课程默认每周重复。";
  elements.scheduleSubmitButton.textContent = "保存到每周课表";
  elements.cancelScheduleEditButton.hidden = true;
}

function activateTab(tab) {
  const task = tab === "task";
  elements.taskTab.classList.toggle("is-active", task);
  elements.scheduleTab.classList.toggle("is-active", !task);
  elements.taskTab.setAttribute("aria-selected", String(task));
  elements.scheduleTab.setAttribute("aria-selected", String(!task));
  elements.taskFormPanel.hidden = !task;
  elements.scheduleFormPanel.hidden = task;
}

async function initializeNativeShell() {
  if (!isNativeApp) return;
  state.nativeSettings = await loadNotificationSettings();
  renderNativeSettings();
  state.nativeCleanup = await initNativeShell({
    onResume: async () => {
      await state.sync?.flushOutbox();
      await state.sync?.pullAll();
      await refreshNativeIntegrations();
    },
    onNotificationAction: handleNativeNotificationAction,
    onBack: handleNativeBack
  });
}

function renderNativeSettings() {
  const settings = state.nativeSettings || { enabled: false, taskLeadMinutes: 30, courseLeadMinutes: 10, badgeEnabled: true };
  elements.nativeSettingsPanel.hidden = false;
  elements.nativeNotificationsEnabled.checked = settings.enabled;
  elements.nativeTaskLeadMinutes.value = String(settings.taskLeadMinutes);
  elements.nativeCourseLeadMinutes.value = String(settings.courseLeadMinutes);
  elements.nativeBadgeEnabled.checked = settings.badgeEnabled;
  elements.nativePermissionText.textContent = settings.enabled
    ? "本地提醒已开启：任务截止前 30 分钟、上课前 10 分钟。"
    : "提醒默认关闭，只有在这里开启后才会请求系统权限。";
}

async function handleNativeNotificationToggle() {
  const enabled = elements.nativeNotificationsEnabled.checked;
  if (enabled) {
    const granted = await requestNotificationPermission();
    if (!granted) {
      elements.nativeNotificationsEnabled.checked = false;
      elements.nativePermissionText.textContent = "系统通知权限未开启，请到 Android 设置中允许通知。";
      showToast("未获得通知权限。", "warning");
      return;
    }
  }
  state.nativeSettings = await saveNotificationSettings({ ...state.nativeSettings, enabled });
  if (!enabled) await clearNativeNotifications();
  renderNativeSettings();
  await refreshNativeIntegrations();
}

async function handleNativeLeadChange() {
  state.nativeSettings = await saveNotificationSettings({
    ...state.nativeSettings,
    taskLeadMinutes: Number(elements.nativeTaskLeadMinutes.value),
    courseLeadMinutes: Number(elements.nativeCourseLeadMinutes.value)
  });
  renderNativeSettings();
  await refreshNativeIntegrations();
}

async function handleNativeBadgeToggle() {
  state.nativeSettings = await saveNotificationSettings({ ...state.nativeSettings, badgeEnabled: elements.nativeBadgeEnabled.checked });
  renderNativeSettings();
  await refreshNativeIntegrations();
}

function scheduleNativeIntegrationRefresh() {
  if (!isNativeApp) return;
  window.clearTimeout(state.nativeRefreshTimer);
  state.nativeRefreshTimer = window.setTimeout(refreshNativeIntegrations, 700);
}

async function refreshNativeIntegrations() {
  if (!isNativeApp || !state.started) return;
  const settings = await loadNotificationSettings();
  state.nativeSettings = settings;
  await Promise.all([
    refreshNativeNotifications(state.data, settings),
    updateNativeBadge(state.data, settings)
  ]);
}

function handleNativeNotificationAction(extra) {
  if (extra?.type === "task" && extra.entityId) {
    state.rotationKeys = state.rotationKeys.filter((key) => key !== extra.entityId);
    renderAll();
    showToast("已打开提醒对应的任务。", "success");
  } else if (extra?.type === "course" && extra.entityId) {
    activateTab("schedule");
    const slide = document.querySelector("main > .workspace > .control-panel");
    slide?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }
}

async function handleNativeBack({ canGoBack } = {}) {
  const openDialog = [...document.querySelectorAll("dialog[open]")][0];
  if (openDialog) {
    openDialog.close();
    return true;
  }
  if (window.matchMedia("(max-width: 900px)").matches && elements.main.scrollLeft > 16) {
    elements.main.scrollTo({ left: 0, behavior: "smooth" });
    return true;
  }
  if (canGoBack) {
    window.history.back();
    return true;
  }
  return false;
}

function openAccountDialog() {
  elements.accountDialogTitle.textContent = state.user?.id === "preview" ? "本地预览空间" : "我的云端空间";
  elements.accountWorkspaceName.textContent = state.user?.id === "preview" ? "仅保存在本机" : "独立加密空间";
  elements.accountSyncDetail.textContent = elements.syncFootnote.textContent;
  elements.openRotateKeyButton.hidden = state.user?.id === "preview";
  elements.logoutButton.textContent = state.user?.id === "preview" ? "返回登录页" : "退出登录";
  elements.accountDialog.showModal();
}

function openRotateKeyDialog() {
  elements.accountDialog.close();
  elements.rotateKeyError.textContent = "";
  elements.rotateKeyForm.reset();
  elements.rotateKeyDialog.showModal();
}

async function handleRotateKey(event) {
  event.preventDefault();
  elements.rotateKeyError.textContent = "";
  const validation = validateKey(elements.newKeyInput.value);
  if (!elements.currentKeyInput.value) {
    elements.rotateKeyError.textContent = "请输入当前密钥。";
    return;
  }
  if (!validation.valid) {
    elements.rotateKeyError.textContent = validation.message;
    return;
  }
  if (validation.key !== normalizeKey(elements.newKeyConfirmInput.value)) {
    elements.rotateKeyError.textContent = "两次输入的新密钥不一致。";
    return;
  }

  setButtonBusy(elements.rotateKeySubmitButton, true, "正在更换");
  try {
    await rotateWorkspaceKey(elements.currentKeyInput.value, validation.key);
    elements.rotateKeyDialog.close();
    showToast("空间密钥已更换，其他设备需要重新登录。", "success");
  } catch (error) {
    elements.rotateKeyError.textContent = friendlyAuthError(error);
  } finally {
    setButtonBusy(elements.rotateKeySubmitButton, false, "确认更换");
  }
}

function openScheduleShareDialog(tab = "create") {
  elements.shareDialogError.textContent = "";
  elements.shareCodeOutput.textContent = "点击下方按钮生成";
  elements.claimShareCodeInput.value = "";
  activateShareTab(tab);
  elements.scheduleShareDialog.showModal();
}

function activateShareTab(tab) {
  const create = tab === "create";
  elements.shareCreateTab.classList.toggle("is-active", create);
  elements.shareClaimTab.classList.toggle("is-active", !create);
  elements.shareCreateTab.setAttribute("aria-selected", String(create));
  elements.shareClaimTab.setAttribute("aria-selected", String(!create));
  elements.shareCreatePanel.hidden = !create;
  elements.shareClaimPanel.hidden = create;
  elements.shareDivider.hidden = true;
}

function setupMobileDeck() {
  const slides = () => [
    document.querySelector("main > .focus-panel"),
    document.querySelector("main > .status-strip"),
    document.querySelector("main > .workspace > .queue-panel"),
    document.querySelector("main > .workspace > .control-panel")
  ].filter(Boolean);
  const navButtons = [...elements.mobileDeckNav.querySelectorAll("button[data-slide]")];
  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const slide = slides()[Number(button.dataset.slide)];
      slide?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    });
  });
  elements.main.addEventListener("scroll", () => {
    if (!window.matchMedia("(max-width: 900px)").matches) return;
    const center = elements.main.getBoundingClientRect().left + elements.main.clientWidth / 2;
    let active = 0;
    slides().forEach((slide, index) => {
      const rect = slide.getBoundingClientRect();
      if (Math.abs(rect.left + rect.width / 2 - center) < Math.abs(slides()[active].getBoundingClientRect().left + slides()[active].getBoundingClientRect().width / 2 - center)) active = index;
    });
    navButtons.forEach((button, index) => button.classList.toggle("is-active", index === active));
  }, { passive: true });
  navButtons[0]?.classList.add("is-active");
}

function getShareSemester() {
  const semesterIdsWithCourses = new Set(state.data.courses.map((course) => course.semesterId).filter(Boolean));
  return state.data.semesters.find((semester) => semester.isActive && semesterIdsWithCourses.has(semester.id))
    || state.data.semesters.find((semester) => semesterIdsWithCourses.has(semester.id))
    || null;
}

async function handleCreateShareCode() {
  elements.shareDialogError.textContent = "";
  const semester = getShareSemester();
  if (!semester) {
    elements.shareDialogError.textContent = "当前没有可分享的课程表。";
    return;
  }
  setButtonBusy(elements.createShareCodeButton, true, "正在生成");
  try {
    const result = await createScheduleShare(semester.id);
    elements.shareCodeOutput.textContent = result.code;
    elements.shareCodeOutput.dataset.code = result.code;
    showToast("分享码已生成，可发给室友。", "success");
  } catch (error) {
    elements.shareDialogError.textContent = friendlyAuthError(error);
  } finally {
    setButtonBusy(elements.createShareCodeButton, false, "生成分享码");
  }
}

async function copyShareCode() {
  const code = elements.shareCodeOutput.dataset.code || elements.shareCodeOutput.textContent;
  if (!/^CLASS-/.test(code)) {
    showToast("请先生成分享码。", "warning");
    return;
  }
  await navigator.clipboard.writeText(code);
  showToast("分享码已复制。", "success");
}

async function handleClaimShareCode() {
  elements.shareDialogError.textContent = "";
  const code = elements.claimShareCodeInput.value.trim().toUpperCase();
  if (!/^CLASS-[A-Z2-9]{8}$/.test(code)) {
    elements.shareDialogError.textContent = "请输入形如 CLASS-XXXXXXXX 的分享码。";
    return;
  }
  setButtonBusy(elements.claimShareCodeButton, true, "正在复制");
  try {
    const result = await claimScheduleShare(code);
    elements.scheduleShareDialog.close();
    await state.sync.pullAll();
    renderAll();
    showToast("已复制 " + Number(result.courses || 0) + " 门课程。", "success");
  } catch (error) {
    elements.shareDialogError.textContent = friendlyAuthError(error);
  } finally {
    setButtonBusy(elements.claimShareCodeButton, false, "复制到我的课表");
  }
}

async function handleLogout() {
  if (state.user?.id === "preview") {
    elements.accountDialog.close();
    state.sync?.destroy();
    state.started = false;
    await clearNativeNotifications();
    await updateNativeBadge({ tasks: [] });
    showAuth();
    return;
  }
  await signOut();
  elements.accountDialog.close();
  state.sync?.destroy();
  state.started = false;
  await clearNativeNotifications();
  await updateNativeBadge({ tasks: [] });
  showAuth();
}

function exportData() {
  if (!state.sync) return;
  const payload = state.sync.exportData();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `此刻数据-${getDateKey()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast("数据已导出。", "success");
}

const icons = {
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 5v5.42l3.3 1.9-1 1.73-4.3-2.48V7h2Z"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v13a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2h2V2Zm12 8H5v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9Z"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.2 16.6-5-5L2.8 13l6.4 6.4L21.6 7 20.2 5.6 9.2 16.6Z"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16.9 3.5 3.6 3.6L8.1 19.5 3.5 20.5l1-4.6L16.9 3.5Zm0 2.8L7 16.1l-.4 1.8 1.8-.4 9.7-9.8-1.2-1.4Zm2.2 1.6 1.4-1.4-2.2-2.2-1.4 1.4 2.2 2.2Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.7 12H7.7L7 9Zm3 2v7h2v-7h-2Zm3 0v7h2v-7h-2Z"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4h2v11.2l4.6-4.6L19 12l-7 7-7-7 1.4-1.4 4.6 4.6V4Z"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7L8 5Z"/></svg>'
};

function renderAll(now = new Date()) {
  if (!state.started) return;
  const queueItems = getOrderedQueueItems(now);
  const focus = queueItems[0] || null;
  renderFocus(focus, now);
  renderUpNext(queueItems, focus, now);
  renderTasks(queueItems, focus, now);
  renderSchedule(now);
  renderStats(now);
  renderNotice(focus, now);
  elements.queueCount.textContent = String(state.data.tasks.length);
  const validKeys = new Set(getBaseQueueItems(now).map((item) => getFocusKey(item)));
  state.rotationKeys = state.rotationKeys.filter((key) => validKeys.has(key));
  if (state.lastRotationKey && !state.rotationKeys.includes(state.lastRotationKey)) state.lastRotationKey = null;
  elements.undoSkipButton.hidden = !state.lastRotationKey;
  updateWorkspaceIdentity();
}

function getBaseQueueItems(now = new Date()) {
  return getRankedCandidates(state.data.tasks, state.data.semesters, state.data.courses, new Set(), now);
}

function getOrderedQueueItems(now = new Date()) {
  const base = getBaseQueueItems(now);
  if (!base.length) {
    const nextCourse = findNextCourseItem(state.data.semesters, state.data.courses, now);
    return nextCourse ? [nextCourse] : [];
  }
  const rotationIndex = new Map(state.rotationKeys.map((key, index) => [key, index]));
  return [...base].sort((a, b) => {
    const aKey = getFocusKey(a);
    const bKey = getFocusKey(b);
    const aRotated = rotationIndex.has(aKey) ? 1 : 0;
    const bRotated = rotationIndex.has(bKey) ? 1 : 0;
    if (aRotated !== bRotated) return aRotated - bRotated;
    if (aRotated && bRotated) return rotationIndex.get(aKey) - rotationIndex.get(bKey);
    return 0;
  });
}

function getFocusItem(now = new Date()) {
  return getOrderedQueueItems(now)[0] || null;
}

function getFocusKey(item) {
  if (!item) return "";
  return item.type === "course" ? item.key : item.task.id;
}

function renderFocus(item, now) {
  const changed = state.lastCurrentKey !== getFocusKey(item);
  state.lastCurrentKey = getFocusKey(item);

  if (!item) {
    const completedToday = state.data.completed.some((entry) => isSameDay(entry.completedAt, now));
    elements.focusStatus.textContent = completedToday ? "今日队列已清空" : "等待你的第一个任务";
    elements.focusPrefix.textContent = completedToday ? "现在可以" : "现在可以先做";
    elements.currentTaskTitle.textContent = completedToday ? "休息一下" : "添加第一个任务";
    elements.currentTaskMeta.innerHTML = [
      metaChip(icons.clock, "预计耗时 5 分钟"),
      metaChip(icons.calendar, state.data.courses.length ? `已录入 ${state.data.courses.length} 节课程` : "添加课程后可自动置顶"),
      metaChip(icons.pin, state.user?.id === "preview" ? "当前仅本地保存" : "云端同步已开启")
    ].join("");
    elements.skipTaskButton.disabled = true;
    elements.completeCurrentButton.disabled = true;
    elements.completeCurrentButton.textContent = "标记完成";
    return;
  }

  if (item.type === "course") {
    const active = item.state === "active";
    const semester = item.semester || state.data.semesters.find((entry) => entry.id === item.course.semesterId);
    elements.focusStatus.textContent = active
      ? `固定课表优先 · ${formatDuration(Math.max(1, Math.round((item.end - now.getTime()) / 60000)))}后结束`
      : `下一项安排 · ${formatDayTime(item.start, now)}`;
    elements.focusPrefix.textContent = active ? "当前你应该做" : "接下来你应该做";
    elements.currentTaskTitle.textContent = item.course.name;
    elements.currentTaskMeta.innerHTML = [
      metaChip(icons.clock, `${item.course.startTime} - ${item.course.endTime}`),
      item.course.location ? metaChip(icons.pin, item.course.location) : "",
      metaChip(icons.calendar, getCourseWeekLabel(item.course, semester)),
      item.course.teacher ? metaChip(icons.pin, item.course.teacher) : ""
    ].filter(Boolean).join("");
    elements.skipTaskButton.disabled = !active;
    elements.completeCurrentButton.disabled = true;
    elements.completeCurrentButton.textContent = active ? "课程进行中" : "尚未开始";
  } else {
    const deadline = getDeadlineInfo(item.task.deadline, now);
    elements.focusStatus.textContent = `当前优先 · ${IMPORTANCE[item.task.importance].description}`;
    elements.focusPrefix.textContent = "当前你应该做";
    elements.currentTaskTitle.textContent = item.task.name;
    elements.currentTaskMeta.innerHTML = [
      metaChip(icons.clock, `预计 ${formatDuration(item.task.durationMinutes)}`),
      metaChip(icons.calendar, deadline.hasDeadline ? `${deadline.overdue ? "已逾期" : "截止"} ${formatAbsolute(new Date(item.task.deadline).getTime())}` : "未设置截止时间"),
      deadline.hasDeadline ? metaChip(icons.clock, deadline.text) : "",
      isTaskLowered(item.task, now) ? metaChip(icons.down, "已临时降低优先级") : ""
    ].filter(Boolean).join("");
    elements.skipTaskButton.disabled = false;
    elements.completeCurrentButton.disabled = false;
    elements.completeCurrentButton.textContent = "标记完成";
  }

  if (changed && elements.currentTaskTitle.textContent && elements.currentTaskTitle.animate) {
    elements.currentTaskTitle.animate(
      [{ opacity: 0.35, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: 320, easing: "cubic-bezier(.2,.85,.2,1)" }
    );
  }
}

function metaChip(icon, text) {
  return `<span class="meta-chip">${icon}<span>${escapeHtml(text)}</span></span>`;
}

function renderUpNext(queueItems, focus, now) {
  const focusKey = getFocusKey(focus);
  const items = queueItems.filter((item) => getFocusKey(item) !== focusKey).slice(0, 3);
  if (!items.length) {
    elements.upNextList.innerHTML = '<li class="up-next-empty"><span>队列中没有其他待办</span></li>';
    return;
  }

  elements.upNextList.innerHTML = items.map((item, index) => {
    if (item.type === "course") {
      return `<li><span>${index + 1}</span><div><strong>${escapeHtml(item.course.name)}</strong><small>${escapeHtml(`${item.course.startTime} - ${item.course.endTime}`)}</small></div><em>课表</em></li>`;
    }
    const deadline = getDeadlineInfo(item.task.deadline, now);
    return `<li><span>${index + 1}</span><div><strong>${escapeHtml(item.task.name)}</strong><small>${escapeHtml(deadline.hasDeadline ? deadline.text : `${IMPORTANCE[item.task.importance].label}优先级`)}</small></div><em>第 ${index + 2} 位</em></li>`;
  }).join("");
}

function renderTasks(queueItems, focus, now) {
  if (!queueItems.length) {
    elements.taskList.innerHTML = `<div class="empty-state"><div><div class="empty-illustration" aria-hidden="true"></div><strong>任务队列还是空的</strong><p>添加任务或录入课程，此刻会自动判断下一件事。</p></div></div>`;
    return;
  }
  const focusKey = getFocusKey(focus);
  elements.taskList.innerHTML = queueItems.map((item, index) => item.type === "course"
    ? renderCourseQueueItem(item)
    : renderTaskQueueItem(item, index, focusKey, now)
  ).join("");
}

function renderCourseQueueItem(item) {
  const active = item.state === "active";
  const semester = item.semester || state.data.semesters.find((entry) => entry.id === item.course.semesterId);
  return `<article class="task-item is-course" data-type="course" data-id="${escapeHtml(item.course.id)}">
    <span class="task-check" aria-hidden="true">${active ? icons.play : icons.calendar}</span>
    <div class="task-body"><div class="task-title-line"><span class="rank-badge is-first">${active ? "进行中" : "课表"}</span><h3>${escapeHtml(item.course.name)}</h3></div><div class="task-tags"><span class="tag">${icons.clock}${escapeHtml(`${item.course.startTime} - ${item.course.endTime}`)}</span>${item.course.location ? `<span class="tag">${icons.pin}${escapeHtml(item.course.location)}</span>` : ""}<span class="tag">${icons.calendar}${escapeHtml(getCourseWeekLabel(item.course, semester))}</span></div></div>
    <div class="task-actions"><button class="icon-button" type="button" data-action="edit-course" data-id="${escapeHtml(item.course.id)}" aria-label="编辑课程">${icons.edit}</button><button class="icon-button danger" type="button" data-action="delete-course" data-id="${escapeHtml(item.course.id)}" aria-label="删除课程">${icons.trash}</button></div>
  </article>`;
}

function renderTaskQueueItem(item, index, focusKey, now) {
  const task = item.task;
  const deadline = getDeadlineInfo(task.deadline, now);
  const lowered = isTaskLowered(task, now);
  const current = getFocusKey(item) === focusKey;
  const importance = IMPORTANCE[task.importance];
  return `<article class="task-item ${current ? "is-current" : ""}" data-type="task" data-id="${escapeHtml(task.id)}" style="--importance-color:${importance.color}">
    <button class="task-check" type="button" data-action="complete-task" data-id="${escapeHtml(task.id)}" aria-label="完成任务">${icons.check}</button>
    <div class="task-body"><div class="task-title-line"><span class="rank-badge ${index === 0 ? "is-first" : ""}">${current ? "当前" : `第 ${index + 1} 位`}</span><h3>${escapeHtml(task.name)}</h3></div><div class="task-tags"><span class="tag importance-${task.importance}">${importance.label}级 · ${importance.description}</span><span class="tag ${deadline.overdue ? "is-overdue" : deadline.urgent ? "is-urgent" : ""}">${icons.calendar}${escapeHtml(deadline.hasDeadline ? `${deadline.overdue ? "已逾期" : "截止"} ${formatAbsolute(new Date(task.deadline).getTime())}` : "无截止时间")}</span><span class="tag">${icons.clock}${escapeHtml(formatDuration(task.durationMinutes))}</span>${lowered ? `<span class="tag is-lowered">${icons.down}临时降级至 ${formatTime(new Date(task.loweredUntil).getTime())}</span>` : ""}</div></div>
    <div class="task-actions"><button class="icon-button ${lowered ? "active" : ""}" type="button" data-action="lower-task" data-id="${escapeHtml(task.id)}" aria-label="临时降低优先级">${icons.down}</button><button class="icon-button" type="button" data-action="edit-task" data-id="${escapeHtml(task.id)}" aria-label="编辑任务">${icons.edit}</button><button class="icon-button danger" type="button" data-action="delete-task" data-id="${escapeHtml(task.id)}" aria-label="删除任务">${icons.trash}</button></div>
  </article>`;
}

function renderSchedule(now) {
  const courses = [...state.data.courses].sort((a, b) => Number(a.weekday) - Number(b.weekday) || timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  elements.scheduleCount.textContent = `${courses.length} 节`;
  if (!courses.length) {
    elements.scheduleList.innerHTML = '<div class="empty-state compact"><p>还没有课程。可手动添加，或使用浏览器扩展从教务系统导入。</p></div>';
    return;
  }

  const grouped = new Map();
  courses.forEach((course) => {
    if (!grouped.has(course.weekday)) grouped.set(course.weekday, []);
    grouped.get(course.weekday).push(course);
  });

  elements.scheduleList.innerHTML = [1, 2, 3, 4, 5, 6, 7].filter((day) => grouped.has(day)).map((day) => {
    const items = grouped.get(day).map((course) => {
      const semester = state.data.semesters.find((item) => item.id === course.semesterId);
      const active = isCourseActive(course, now, state.data.semesters);
      return `<div class="schedule-item ${active ? "is-active" : ""}">
        <span class="schedule-time">${escapeHtml(course.startTime)}<br>${escapeHtml(course.endTime)}</span>
        <div class="schedule-info"><strong>${escapeHtml(course.name)}</strong><small>${escapeHtml(course.location || course.teacher || "未填写地点")} · ${escapeHtml(getCourseWeekLabel(course, semester))}</small></div>
        <div class="schedule-actions"><button class="icon-button" type="button" data-action="edit-course" data-id="${escapeHtml(course.id)}" aria-label="编辑课程">${icons.edit}</button><button class="icon-button danger" type="button" data-action="delete-course" data-id="${escapeHtml(course.id)}" aria-label="删除课程">${icons.trash}</button></div>
      </div>`;
    }).join("");
    return `<div class="schedule-day"><div class="schedule-day-label">${WEEKDAYS[day]}${day === (now.getDay() || 7) ? " · 今天" : ""}</div>${items}</div>`;
  }).join("");
}

function renderStats(now) {
  const pending = state.data.tasks.length;
  const todayCompleted = state.data.completed.filter((entry) => isSameDay(entry.completedAt, now)).length;
  const dueTodayPending = state.data.tasks.filter((task) => task.deadline && isSameDay(task.deadline, now)).length;
  const denominator = todayCompleted + dueTodayPending;
  const percent = denominator > 0 ? Math.round((todayCompleted / denominator) * 100) : pending === 0 && todayCompleted > 0 ? 100 : 0;
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
  if (!state.data.tasks.length && !state.data.courses.length) {
    elements.noticeText.textContent = "添加任务或课程后，我会根据时间、截止日期和重要等级自动推荐。";
    return;
  }
  if (!focus) {
    elements.noticeText.textContent = "当前任务已跳过或完成。可以撤销跳过，或继续添加新的安排。";
    return;
  }
  if (focus.type === "course") {
    elements.noticeText.textContent = focus.state === "active"
      ? `“${focus.course.name}”正在进行，固定课表已自动置顶。`
      : `下一项安排是“${focus.course.name}”，将在 ${formatDayTime(focus.start, now)} 开始。`;
    return;
  }
  const deadline = getDeadlineInfo(focus.task.deadline, now);
  if (deadline.overdue) elements.noticeText.textContent = `“${focus.task.name}”已经逾期，系统将它排在最前面。`;
  else if (deadline.hasDeadline && deadline.remainingMs <= 3 * HOUR) elements.noticeText.textContent = `“${focus.task.name}”${deadline.text}，截止时间最近，因此优先推荐。`;
  else if (!deadline.hasDeadline) elements.noticeText.textContent = `“${focus.task.name}”是当前重要等级最高的无截止时间任务。`;
  else elements.noticeText.textContent = `系统已按课表、截止时间和重要等级排序，当前推荐“${focus.task.name}”。`;
}

function updateSyncStatus(status) {
  state.syncState = { ...state.syncState, ...status };
  const stateName = status.state || "ready";
  elements.syncStatusButton.classList.toggle("is-offline", stateName === "offline");
  elements.syncStatusButton.classList.toggle("is-error", stateName === "error");
  elements.syncStatusText.textContent = status.text || "已同步";
  elements.syncFootnote.textContent = state.user?.id === "preview"
    ? "当前为本地预览，数据只保存在设备中"
    : stateName === "offline"
      ? "离线中，修改会在联网后自动同步"
      : stateName === "error"
        ? "同步遇到问题，正在重试"
        : status.text || "所有数据已同步";
  if (state.user) updateWorkspaceIdentity();
}

function updateWorkspaceIdentity() {
  const preview = state.user?.id === "preview";
  elements.workspaceLabel.textContent = preview ? "本地预览空间" : "云端安全同步";
  elements.accountInitial.textContent = preview ? "本" : "此";
}

function updateClock(now = new Date()) {
  elements.liveDate.textContent = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(now);
  elements.liveTime.textContent = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now);
}

function tick(forceRender = false) {
  const now = new Date();
  updateClock(now);
  const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
  if (forceRender || minuteKey !== state.lastMinuteKey) {
    state.lastMinuteKey = minuteKey;
    if (state.started) renderAll(now);
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
    window.setTimeout(() => toast.remove(), 220);
  }, 3600);
}

function registerServiceWorker() {
  if (isNativeApp || !("serviceWorker" in navigator) || import.meta.env.DEV) return;
  const workerUrl = `${import.meta.env.BASE_URL}service-worker.js`;
  window.addEventListener("load", () => navigator.serviceWorker.register(workerUrl).catch((error) => console.warn("Service worker 注册失败", error)));
}
