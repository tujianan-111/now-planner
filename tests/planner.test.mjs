import test from "node:test";
import assert from "node:assert/strict";
import { getCurrentWeek, getRankedCandidates, isCourseActive, isCourseInWeek } from "../src/planner.js";

const semester = { id: "s1", name: "2026-2027-1", startDate: "2026-09-07", weekCount: 20 };
const course = { id: "c1", semesterId: "s1", name: "工程力学", weekday: 1, startTime: "10:20", endTime: "11:50", weekNumbers: [5] };
const now = new Date("2026-10-05T10:30:00+08:00");

test("计算学期周次", () => {
  assert.equal(getCurrentWeek(semester, now), 5);
});

test("周次外不显示课程", () => {
  assert.equal(isCourseInWeek(course, semester, now), true);
  assert.equal(isCourseInWeek({ ...course, weekNumbers: [4] }, semester, now), false);
});

test("上课时间自动成为最高优先级", () => {
  const tasks = [{ id: "t1", name: "紧急作业", importance: "high", deadline: "2026-10-05T11:00:00+08:00", durationMinutes: 30, createdAt: "2026-10-01T00:00:00Z" }];
  assert.equal(isCourseActive(course, now, [semester]), true);
  const ranked = getRankedCandidates(tasks, [semester], [course], new Set(), now);
  assert.equal(ranked[0].type, "course");
  assert.equal(ranked[1].task.name, "紧急作业");
});
