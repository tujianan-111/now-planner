export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

export const IMPORTANCE = {
  high: { label: "高", description: "关键任务", rank: 0, color: "#a85e55" },
  medium: { label: "中", description: "常规任务", rank: 1, color: "#b89555" },
  low: { label: "低", description: "可以稍后", rank: 2, color: "#76917a" }
};

export const WEEKDAYS = ["", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"];

export function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (char) =>
    (Number(char) ^ (Math.random() * 16 >> Number(char) / 4)).toString(16)
  );
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function formatTimeRange(start, end) {
  return `${start} - ${end}`;
}

export function formatDuration(minutes) {
  const value = Math.max(1, Math.round(Number(minutes) || 0));
  if (value < 60) return `${value} 分钟`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  if (hours < 24) return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days} 天 ${restHours} 小时` : `${days} 天`;
}

export function formatAbsolute(timestamp) {
  if (!Number.isFinite(timestamp)) return "无";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(timestamp));
}

export function formatTime(timestamp) {
  if (!Number.isFinite(timestamp)) return "--:--";
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(timestamp));
}

export function formatDayTime(timestamp, now = new Date()) {
  if (!Number.isFinite(timestamp)) return "时间未定";
  const target = new Date(timestamp);
  const sameDay = isSameDay(timestamp, now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayLabel = sameDay ? "今天" : isSameDay(timestamp, tomorrow) ? "明天" : `${WEEKDAYS[toWeekday(target)]}`;
  return `${dayLabel} ${formatTime(timestamp)}`;
}

export function getDeadlineInfo(deadline, now = new Date()) {
  const timestamp = deadline ? new Date(deadline).getTime() : NaN;
  if (!Number.isFinite(timestamp)) {
    return { hasDeadline: false, overdue: false, urgent: false, text: "无截止时间", shortText: "没有设置截止时间", remainingMs: Infinity };
  }

  const remainingMs = timestamp - now.getTime();
  const overdue = remainingMs < 0;
  const readable = formatDuration(Math.max(1, Math.round(Math.abs(remainingMs) / 60000)));
  return {
    hasDeadline: true,
    overdue,
    urgent: !overdue && remainingMs <= 3 * HOUR,
    remainingMs,
    text: overdue ? `已逾期 ${readable}` : `还剩 ${readable}`,
    shortText: overdue ? `已经逾期 ${readable}` : `截止时间还有 ${readable}`
  };
}

export function isSameDay(left, right) {
  const a = new Date(left);
  const b = new Date(right);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function getDateKey(dateLike = new Date()) {
  const date = new Date(dateLike);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function toDateTimeLocal(timestamp) {
  const date = new Date(timestamp);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(timestamp - offset).toISOString().slice(0, 16);
}

export function toWeekday(dateLike = new Date()) {
  const day = new Date(dateLike).getDay();
  return day === 0 ? 7 : day;
}

export function timeToMinutes(value) {
  const [hours, minutes] = String(value || "00:00").split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export function dateAtTime(dateLike, time) {
  const date = new Date(dateLike);
  const minutes = timeToMinutes(time);
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date.getTime();
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function debounce(callback, wait = 200) {
  let timer = 0;
  return (...args) => {
    clearTimeout(timer);
    timer = window.setTimeout(() => callback(...args), wait);
  };
}
