const WEEKDAY_NAMES = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"];

export function decodeEntities(value) {
  return String(value ?? "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&");
}

function stripTags(value) {
  return decodeEntities(String(value ?? ""))
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getAttribute(tag, name) {
  const match = String(tag).match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i"));
  return match ? decodeEntities(match[1]) : "";
}

export function parseWeekStatus(value) {
  const match = String(value ?? "").match(/第\s*(\d+)\s*周\s*\/\s*(\d+)\s*周/);
  return match ? { currentWeek: Number(match[1]), totalWeeks: Number(match[2]) } : null;
}

export function getMonday(dateLike = new Date()) {
  const date = new Date(dateLike);
  date.setHours(0, 0, 0, 0);
  const weekday = date.getDay() === 0 ? 7 : date.getDay();
  date.setDate(date.getDate() - (weekday - 1));
  return date;
}

export function inferTermStart(selectedDate, currentWeek) {
  const monday = getMonday(selectedDate);
  monday.setDate(monday.getDate() - (Number(currentWeek) - 1) * 7);
  return monday;
}

export function addDays(dateLike, days) {
  const date = new Date(dateLike);
  date.setDate(date.getDate() + Number(days));
  return date;
}

export function formatDateInput(dateLike) {
  const date = new Date(dateLike);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function extractCourseDetails(title, fallbackWeek = null, weekday = null, slot = null) {
  const details = stripTags(title);
  const read = (label) => {
    const match = details.match(new RegExp(`${label}：([^|]+?)(?=\\s*(?:课程学分|课程属性|课程名称|上课时间|上课地点|任课教师|$))`));
    return match ? match[1].trim() : "";
  };

  const timeText = read("上课时间") || "";
  const weekMatch = timeText.match(/第\s*([\d,\-、]+)\s*周/);
  const periods = timeText.match(/\[(\d{1,2})-(\d{1,2})\]/);
  const weeks = weekMatch ? parseWeekExpression(weekMatch[1]) : fallbackWeek ? [Number(fallbackWeek)] : [];

  return {
    name: read("课程名称") || details.split("|").at(-1)?.trim() || "未命名课程",
    credits: Number(read("课程学分")) || null,
    attribute: read("课程属性") || "",
    teacher: read("任课教师") || read("教师") || "",
    location: read("上课地点").replace(/[（(]\s*$/, "") || "",
    weekday,
    slot,
    startTime: slot?.match(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/)?.[1] || "",
    endTime: slot?.match(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/)?.[2] || "",
    periods: periods ? `${periods[1]}-${periods[2]}` : "",
    weekNumbers: weeks
  };
}

export function parseWeekExpression(value, totalWeeks = 30) {
  const normalized = String(value ?? "").replace(/[第周\s]/g, "");
  if (!normalized) return [];
  if (normalized.includes("单")) return Array.from({ length: totalWeeks }, (_, index) => index + 1).filter((week) => week % 2 === 1);
  if (normalized.includes("双")) return Array.from({ length: totalWeeks }, (_, index) => index + 1).filter((week) => week % 2 === 0);

  const weeks = new Set();
  normalized.split(/[,，、]/).forEach((part) => {
    const range = part.match(/^(\d+)-(\d+)$/);
    if (range) {
      for (let week = Number(range[1]); week <= Number(range[2]); week += 1) weeks.add(week);
      return;
    }
    const single = part.match(/^\d+$/);
    if (single) weeks.add(Number(single[0]));
  });
  return [...weeks].sort((a, b) => a - b);
}

export function parseKbTableHtml(html, fallbackWeek = null) {
  const tableMatch = String(html ?? "").match(/<table[^>]*class="[^"]*kb_table[^"]*"[\s\S]*?<\/table>/i);
  if (!tableMatch) return [];

  const table = tableMatch[0];
  const headers = [...table.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)]
    .map((match) => stripTags(match[1]))
    .filter((text) => WEEKDAY_NAMES.includes(text));
  const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const output = [];

  rows.forEach((rowMatch) => {
    const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => match[1]);
    if (cells.length < 2) return;
    const slot = stripTags(cells[0]);
    if (!/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/.test(slot)) return;

    cells.slice(1).forEach((cell, index) => {
      const titleTag = cell.match(/<p[^>]*title\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/i);
      if (!titleTag) return;
      const weekday = headers[index] || WEEKDAY_NAMES[index];
      const detail = extractCourseDetails(titleTag[1] ?? titleTag[2], fallbackWeek, weekday, slot);
      if (!detail.name || !detail.startTime) return;
      output.push(detail);
    });
  });

  return output;
}

export function mergeOccurrences(occurrences, semesterId = null) {
  const groups = new Map();

  occurrences.forEach((occurrence) => {
    const base = {
      semesterId,
      name: occurrence.name.trim(),
      weekday: Number((WEEKDAY_NAMES.indexOf(occurrence.weekday) + 1) || 1),
      startTime: occurrence.startTime,
      endTime: occurrence.endTime,
      location: occurrence.location || "",
      teacher: occurrence.teacher || "",
      credits: occurrence.credits || null,
      attribute: occurrence.attribute || "",
      periods: occurrence.periods || ""
    };
    const key = [base.name, base.weekday, base.startTime, base.endTime, base.location, base.teacher].join("|");
    if (!groups.has(key)) groups.set(key, { ...base, weekNumbers: new Set(), sourceKey: stableSourceKey(base) });
    const group = groups.get(key);
    occurrence.weekNumbers.forEach((week) => group.weekNumbers.add(Number(week)));
  });

  return [...groups.values()]
    .map((group) => ({ ...group, weekNumbers: [...group.weekNumbers].sort((a, b) => a - b) }))
    .sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime) || a.name.localeCompare(b.name, "zh-CN"));
}

export function stableSourceKey(course) {
  const value = [course.name, course.weekday, course.startTime, course.endTime, course.location, course.teacher].join("|");
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `jwxt-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function totalWeeksFromCourses(courses) {
  return courses.reduce((max, course) => Math.max(max, ...(course.weekNumbers || [0])), 0);
}
