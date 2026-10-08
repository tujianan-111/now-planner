import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Preferences } from "@capacitor/preferences";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { Badge } from "@capawesome/capacitor-badge";
import { isCourseInWeek } from "./planner.js";
import { DAY, dateAtTime, toWeekday } from "./utils.js";

const SETTINGS_KEY = "now-planner.notification-settings.v1";
const FOCUS_STATE_KEY = "now-planner.focus-timer.v1";
const FOCUS_NOTIFICATION_ID = 1900000001;
const FOCUS_FINISH_NOTIFICATION_ID = 1900000002;

export const isNativeApp = Capacitor.isNativePlatform();

export const secureStorageAdapter = {
  async getItem(key) {
    if (isNativeApp) return SecureStorage.getItem(key);
    return window.localStorage.getItem(key);
  },
  async setItem(key, value) {
    if (isNativeApp) return SecureStorage.setItem(key, value);
    window.localStorage.setItem(key, value);
  },
  async removeItem(key) {
    if (isNativeApp) return SecureStorage.removeItem(key);
    window.localStorage.removeItem(key);
  }
};

export async function loadNotificationSettings() {
  try {
    const { value } = await Preferences.get({ key: SETTINGS_KEY });
    return normalizeSettings(value ? JSON.parse(value) : null);
  } catch {
    return normalizeSettings(null);
  }
}

export async function saveNotificationSettings(settings) {
  const normalized = normalizeSettings(settings);
  await Preferences.set({ key: SETTINGS_KEY, value: JSON.stringify(normalized) });
  return normalized;
}

export async function requestNotificationPermission() {
  if (!isNativeApp) return false;
  const current = await LocalNotifications.checkPermissions();
  if (current.display === "granted") return true;
  const result = await LocalNotifications.requestPermissions();
  return result.display === "granted";
}

export async function initNativeShell({ onResume, onNotificationAction, onBack } = {}) {
  if (!isNativeApp) return () => {};

  const listeners = [];
  await StatusBar.setStyle({ style: Style.Dark });
  await StatusBar.setBackgroundColor({ color: "#F7F3E9" });
  await ensureNotificationChannels();

  listeners.push(await App.addListener("resume", async () => {
    await onResume?.();
  }));

  listeners.push(await App.addListener("backButton", async ({ canGoBack }) => {
    const handled = await onBack?.({ canGoBack });
    if (!handled) await App.exitApp();
  }));

  listeners.push(await LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
    onNotificationAction?.(event.notification.extra || {});
  }));

  return () => listeners.forEach((listener) => listener.remove());
}

export async function hideNativeSplash() {
  if (!isNativeApp) return;
  await SplashScreen.hide({ fadeOutDuration: 260 });
}

export async function refreshNativeNotifications(data, settings = null) {
  if (!isNativeApp) return;
  const activeSettings = settings || await loadNotificationSettings();
  await cancelOwnedNotifications();
  if (!activeSettings.enabled) return;

  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted") return;

  const now = Date.now();
  const horizon = now + 7 * DAY;
  const notifications = [];

  for (const task of data.tasks || []) {
    if (!task.deadline) continue;
    const deadline = new Date(task.deadline).getTime();
    const reminderAt = deadline - activeSettings.taskLeadMinutes * 60 * 1000;
    if (reminderAt <= now || reminderAt > horizon) continue;
    notifications.push({
      id: stableNotificationId(`task:${task.id}`),
      title: "任务即将截止",
      body: `${task.name} · ${formatReminderLead(activeSettings.taskLeadMinutes)}`,
      channelId: "task-deadline",
      smallIcon: "ic_stat_now_planner",
      schedule: { at: new Date(reminderAt), allowWhileIdle: true, isExactNotification: false },
      extra: { type: "task", entityId: task.id }
    });
  }

  for (let offset = 0; offset <= 7; offset += 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    for (const course of data.courses || []) {
      if (Number(course.weekday) !== toWeekday(date)) continue;
      const semester = (data.semesters || []).find((item) => item.id === course.semesterId) || null;
      if (!isCourseInWeek(course, semester, date)) continue;
      const startsAt = dateAtTime(date, course.startTime);
      const reminderAt = startsAt - activeSettings.courseLeadMinutes * 60 * 1000;
      if (reminderAt <= now || reminderAt > horizon) continue;
      notifications.push({
        id: stableNotificationId(`course:${course.id}:${date.toDateString()}`),
        title: "课程即将开始",
        body: `${course.name} · ${course.startTime}${course.location ? ` · ${course.location}` : ""}`,
        channelId: "class-start",
        smallIcon: "ic_stat_now_planner",
        schedule: { at: new Date(reminderAt), allowWhileIdle: true, isExactNotification: false },
        extra: { type: "course", entityId: course.id }
      });
    }
  }

  if (notifications.length) await LocalNotifications.schedule({ notifications: notifications.slice(0, 400) });
}

export async function updateNativeBadge(data, settings = null) {
  if (!isNativeApp) return;
  const activeSettings = settings || await loadNotificationSettings();
  if (!activeSettings.badgeEnabled) {
    await safelyClearBadge();
    return;
  }
  const pending = (data.tasks || []).length;
  const overdue = (data.tasks || []).filter((task) => task.deadline && new Date(task.deadline).getTime() < Date.now()).length;
  await safelySetBadge(pending + overdue);
}

export async function loadFocusTimerState() {
  try {
    const { value } = await Preferences.get({ key: FOCUS_STATE_KEY });
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export async function saveFocusTimerState(state) {
  await Preferences.set({ key: FOCUS_STATE_KEY, value: JSON.stringify(state) });
}

export async function clearFocusTimerState() {
  await Preferences.remove({ key: FOCUS_STATE_KEY });
}

export async function showFocusNotification(taskName, endsAt, paused = false) {
  if (!isNativeApp) return;
  const settings = await loadNotificationSettings();
  if (!settings.enabled) return;
  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted") return;
  await ensureNotificationChannels();
  await LocalNotifications.cancel({ notifications: [{ id: FOCUS_NOTIFICATION_ID }] });
  await LocalNotifications.schedule({
    notifications: [{
      id: FOCUS_NOTIFICATION_ID,
      title: paused ? "专注已暂停" : "25 分钟专注中",
      body: paused ? taskName : taskName + " · 预计 " + formatClockTime(endsAt) + " 结束",
      channelId: "focus-session",
      smallIcon: "ic_stat_now_planner",
      ongoing: !paused,
      autoCancel: false,
      schedule: { at: new Date(Date.now() + 300), allowWhileIdle: true, isExactNotification: false },
      extra: { type: "focus", entityId: "active" }
    }]
  });
}

export async function finishFocusNotification(taskName, focusedSeconds) {
  if (!isNativeApp) return;
  await LocalNotifications.cancel({ notifications: [{ id: FOCUS_NOTIFICATION_ID }] });
  const settings = await loadNotificationSettings();
  if (!settings.enabled) return;
  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted") return;
  await LocalNotifications.schedule({
    notifications: [{
      id: FOCUS_FINISH_NOTIFICATION_ID,
      title: focusedSeconds >= 1500 ? "番茄钟完成" : "专注已记录",
      body: taskName + " · 专注 " + formatFocusedMinutes(focusedSeconds),
      channelId: "focus-session",
      smallIcon: "ic_stat_now_planner",
      autoCancel: true,
      schedule: { at: new Date(Date.now() + 300), allowWhileIdle: true, isExactNotification: false },
      extra: { type: "focus", entityId: "finished" }
    }]
  });
}

export async function cancelFocusNotification() {
  if (!isNativeApp) return;
  try {
    await LocalNotifications.cancel({
      notifications: [{ id: FOCUS_NOTIFICATION_ID }, { id: FOCUS_FINISH_NOTIFICATION_ID }]
    });
  } catch {
    // Ignore cancellation errors when no notification is pending.
  }
}

export async function clearNativeNotifications() {
  if (!isNativeApp) return;
  await cancelOwnedNotifications();
}

async function ensureNotificationChannels() {
  await LocalNotifications.createChannel({
    id: "task-deadline",
    name: "任务截止提醒",
    description: "任务截止前的提醒",
    importance: 4,
    visibility: 1,
    vibration: true
  });
  await LocalNotifications.createChannel({
    id: "focus-session",
    name: "专注番茄钟",
    description: "专注进行中与结束提醒",
    importance: 3,
    visibility: 1,
    vibration: false
  });
  await LocalNotifications.createChannel({
    id: "class-start",
    name: "上课提醒",
    description: "固定课程开始前的提醒",
    importance: 4,
    visibility: 1,
    vibration: true
  });
}

async function cancelOwnedNotifications() {
  try {
    const pending = await LocalNotifications.getPending();
    if (!pending.notifications?.length) return;
    await LocalNotifications.cancel({
      notifications: pending.notifications.map((notification) => ({ id: notification.id }))
    });
  } catch (error) {
    console.warn("取消本地提醒失败", error);
  }
}

async function safelySetBadge(count) {
  try {
    const support = await Badge.isSupported();
    if (support.isSupported) await Badge.set({ count });
  } catch (error) {
    console.warn("设置角标失败", error);
  }
}

async function safelyClearBadge() {
  try {
    const support = await Badge.isSupported();
    if (support.isSupported) await Badge.clear();
  } catch (error) {
    console.warn("清除角标失败", error);
  }
}

function stableNotificationId(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2147483646 + 1;
}

function normalizeSettings(value) {
  return {
    enabled: Boolean(value?.enabled),
    taskLeadMinutes: clampLead(value?.taskLeadMinutes, 30),
    courseLeadMinutes: clampLead(value?.courseLeadMinutes, 10),
    badgeEnabled: value?.badgeEnabled !== false
  };
}

function clampLead(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(180, Math.max(1, Math.round(number)));
}

function formatClockTime(timestamp) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(timestamp));
}

function formatFocusedMinutes(seconds) {
  const minutes = Math.max(0, Math.round(Number(seconds || 0) / 60));
  return minutes < 60 ? minutes + " 分钟" : Math.floor(minutes / 60) + " 小时 " + (minutes % 60) + " 分钟";
}

function formatReminderLead(minutes) {
  if (minutes < 60) return `${minutes} 分钟后截止`;
  return `${Math.round(minutes / 60 * 10) / 10} 小时后截止`;
}
