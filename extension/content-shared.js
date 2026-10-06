(() => {
  const WEEKDAY_NAMES = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"];

  function decodeEntities(value) {
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

  function parseWeekStatus(value) {
    const match = String(value ?? "").match(/第\s*(\d+)\s*周\s*\/\s*(\d+)\s*周/);
    return match ? { currentWeek: Number(match[1]), totalWeeks: Number(match[2]) } : null;
  }

  function getMonday(dateLike = new Date()) {
    const date = new Date(dateLike);
    date.setHours(0, 0, 0, 0);
    const weekday = date.getDay() === 0 ? 7 : date.getDay();
    date.setDate(date.getDate() - (weekday - 1));
    return date;
  }

  function inferTermStart(selectedDate, currentWeek) {
    const monday = getMonday(selectedDate);
    monday.setDate(monday.getDate() - (Number(currentWeek) - 1) * 7);
    return monday;
  }

  function formatDateInput(dateLike) {
    const date = new Date(dateLike);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  }

  function parseWeekExpression(value, fallbackWeek) {
    const normalized = String(value ?? "").replace(/[第周\s]/g, "");
    if (!normalized && fallbackWeek) return [Number(fallbackWeek)];
    if (normalized.includes("单")) return Array.from({ length: 30 }, (_, index) => index + 1).filter((week) => week % 2 === 1);
    if (normalized.includes("双")) return Array.from({ length: 30 }, (_, index) => index + 1).filter((week) => week % 2 === 0);
    const weeks = new Set();
    normalized.split(/[,，、]/).forEach((part) => {
      const range = part.match(/^(\d+)-(\d+)$/);
      if (range) {
        for (let week = Number(range[1]); week <= Number(range[2]); week += 1) weeks.add(week);
      } else if (/^\d+$/.test(part)) {
        weeks.add(Number(part));
      }
    });
    if (!weeks.size && fallbackWeek) weeks.add(Number(fallbackWeek));
    return [...weeks].sort((a, b) => a - b);
  }

  function extractCourseDetails(title, fallbackWeek, weekday, slot) {
    const details = stripTags(title);
    const read = (label) => {
      const match = details.match(new RegExp(`${label}：([^|]+?)(?=\\s*(?:课程学分|课程属性|课程名称|上课时间|上课地点|任课教师|$))`));
      return match ? match[1].trim() : "";
    };
    const timeText = read("上课时间");
    const weekMatch = timeText.match(/第\s*([\d,\-、单双]+)\s*周/);
    const periods = timeText.match(/\[(\d{1,2})-(\d{1,2})\]/);
    const timeMatch = String(slot || "").match(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/);
    return {
      name: read("课程名称") || "未命名课程",
      credits: Number(read("课程学分")) || null,
      attribute: read("课程属性"),
      teacher: read("任课教师") || read("教师"),
      location: read("上课地点"),
      weekday,
      periods: periods ? `${periods[1]}-${periods[2]}` : "",
      startTime: timeMatch?.[1] || "",
      endTime: timeMatch?.[2] || "",
      weekNumbers: parseWeekExpression(weekMatch?.[1] || "", fallbackWeek)
    };
  }

  function parseKbTableHtml(html, fallbackWeek = null) {
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
        const titleTags = [...cell.matchAll(/<p[^>]*title\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/gi)];
        if (!titleTags.length) return;
        const weekday = headers[index] || WEEKDAY_NAMES[index];
        for (const titleTag of titleTags) {
          const detail = extractCourseDetails(titleTag[1] ?? titleTag[2], fallbackWeek, weekday, slot);
          if (detail.name && detail.startTime && detail.endTime) output.push(detail);
        }
      });
    });
    return output;
  }

  function stableSourceKey(course) {
    const value = [course.name, course.weekday, course.startTime, course.endTime, course.location, course.teacher].join("|");
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `jwxt-${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }

  function mergeOccurrences(occurrences) {
    const groups = new Map();
    occurrences.forEach((occurrence) => {
      const course = {
        name: occurrence.name.trim(),
        weekday: NUMBER_WEEKDAY(occurrence.weekday),
        startTime: occurrence.startTime,
        endTime: occurrence.endTime,
        location: occurrence.location || "",
        teacher: occurrence.teacher || "",
        credits: occurrence.credits || null,
        attribute: occurrence.attribute || "",
        periods: occurrence.periods || ""
      };
      const key = [course.name, course.weekday, course.startTime, course.endTime, course.location, course.teacher].join("|");
      if (!groups.has(key)) groups.set(key, { ...course, weekNumbers: new Set() });
      occurrence.weekNumbers.forEach((week) => groups.get(key).weekNumbers.add(Number(week)));
    });

    return [...groups.values()]
      .map((course) => ({
        ...course,
        sourceKey: stableSourceKey(course),
        weekNumbers: [...course.weekNumbers].sort((a, b) => a - b)
      }))
      .sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime) || a.name.localeCompare(b.name, "zh-CN"));
  }

  function NUMBER_WEEKDAY(name) {
    const index = WEEKDAY_NAMES.indexOf(name);
    return index >= 0 ? index + 1 : 1;
  }

  globalThis.NowPlannerShared = {
    WEEKDAY_NAMES,
    parseWeekStatus,
    inferTermStart,
    formatDateInput,
    parseKbTableHtml,
    mergeOccurrences
  };
})();
