import { DAY, HOUR, IMPORTANCE, WEEKDAYS, dateAtTime, getDateKey, timeToMinutes, toWeekday } from "./utils.js";

export function isTaskLowered(task, now = new Date()) {
  const until = task.loweredUntil ? new Date(task.loweredUntil).getTime() : NaN;
  return Number.isFinite(until) && until > now.getTime();
}

export function compareTasks(a, b, now = new Date()) {
  const aHasDeadline = Boolean(a.deadline);
  const bHasDeadline = Boolean(b.deadline);

  if (aHasDeadline !== bHasDeadline) return aHasDeadline ? -1 : 1;

  if (aHasDeadline) {
    const aEffective = new Date(a.deadline).getTime() + (isTaskLowered(a, now) ? 8 * HOUR : 0);
    const bEffective = new Date(b.deadline).getTime() + (isTaskLowered(b, now) ? 8 * HOUR : 0);
    if (aEffective !== bEffective) return aEffective - bEffective;
  }

  const importanceDiff = IMPORTANCE[a.importance].rank - IMPORTANCE[b.importance].rank;
  if (importanceDiff !== 0) return importanceDiff;
  return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
}

export function getCurrentWeek(semester, now = new Date()) {
  if (!semester?.startDate) return null;
  const start = new Date(`${semester.startDate}T00:00:00`);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today - start) / DAY);
  if (diffDays < 0) return 0;
  return Math.floor(diffDays / 7) + 1;
}

export function isCourseInWeek(course, semester, now = new Date()) {
  if (!course.semesterId) return true;
  if (!semester) return false;
  const week = getCurrentWeek(semester, now);
  if (!week || week < 1 || week > Number(semester.weekCount || 20)) return false;
  if (!Array.isArray(course.weekNumbers) || course.weekNumbers.length === 0) return true;
  return course.weekNumbers.includes(week);
}

export function isCourseActive(course, now = new Date(), semesters = []) {
  const semester = semesters.find((item) => item.id === course.semesterId) || null;
  if (!isCourseInWeek(course, semester, now)) return false;
  if (toWeekday(now) !== Number(course.weekday)) return false;
  const start = dateAtTime(now, course.startTime);
  const end = dateAtTime(now, course.endTime);
  const time = now.getTime();
  return time >= start && time < end;
}

export function getRankedCandidates(tasks, semesters, courses, skipped, now = new Date()) {
  const activeCourses = courses
    .filter((course) => isCourseActive(course, now, semesters))
    .map((course) => buildCourseItem(course, now, "active"))
    .filter((item) => !skipped.has(item.key))
    .sort((a, b) => a.start - b.start);

  const rankedTasks = tasks
    .filter((task) => !skipped.has(task.id))
    .map((task) => ({ type: "task", task, key: task.id }))
    .sort((a, b) => compareTasks(a.task, b.task, now));

  return [...activeCourses, ...rankedTasks];
}

export function getCurrentItem(tasks, semesters, courses, skipped, now = new Date()) {
  const candidates = getRankedCandidates(tasks, semesters, courses, skipped, now);
  return candidates[0] || findNextCourseItem(semesters, courses, now);
}

export function findNextCourseItem(semesters, courses, now = new Date()) {
  let nearest = null;

  for (let offset = 0; offset < 14; offset += 1) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + offset);

    courses.forEach((course) => {
      if (Number(course.weekday) !== toWeekday(date)) return;
      const semester = semesters.find((item) => item.id === course.semesterId) || null;
      if (!isCourseInWeek(course, semester, date)) return;
      const start = dateAtTime(date, course.startTime);
      const end = dateAtTime(date, course.endTime);
      if (start <= now.getTime()) return;
      if (!nearest || start < nearest.start) nearest = { course, semester, start, end, offset };
    });

    if (nearest) break;
  }

  if (!nearest) return null;
  return buildCourseItem(nearest.course, now, "next", nearest.start, nearest.end, nearest.semester);
}

export function buildCourseItem(course, now, state = "next", explicitStart, explicitEnd, explicitSemester) {
  const semester = explicitSemester || null;
  const start = explicitStart ?? dateAtTime(now, course.startTime);
  const end = explicitEnd ?? dateAtTime(now, course.endTime);
  return {
    type: "course",
    course,
    semester,
    state,
    start,
    end,
    key: state === "active" ? `course:${course.id}:${getDateKey(now)}` : `next:${course.id}`
  };
}

export function getCourseWeekLabel(course, semester) {
  if (!course.semesterId || !semester) return "每周";
  if (!Array.isArray(course.weekNumbers) || !course.weekNumbers.length) return `${semester.name || "学期"} · 每周`;
  const weeks = [...course.weekNumbers].sort((a, b) => a - b);
  const ranges = [];
  let start = weeks[0];
  let previous = weeks[0];
  for (let index = 1; index <= weeks.length; index += 1) {
    const current = weeks[index];
    if (current === previous + 1) {
      previous = current;
      continue;
    }
    ranges.push(start === previous ? `${start}` : `${start}-${previous}`);
    start = current;
    previous = current;
  }
  return `第 ${ranges.join("、")} 周`;
}
