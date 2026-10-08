import { openDB } from "idb";

const DB_NAME = "now-planner";
const DB_VERSION = 1;

const EMPTY_DATA = {
  tasks: [],
  semesters: [],
  courses: [],
  completed: [],
  skipped: [],
  focusSessions: []
};

let dbPromise;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("cache")) db.createObjectStore("cache");
        if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox", { keyPath: "id" });
      }
    });
  }
  return dbPromise;
}

export async function loadCache(userId = "preview") {
  try {
    const db = await getDb();
    const value = await db.get("cache", userId);
    return normalizeData(value);
  } catch (error) {
    console.warn("读取本地缓存失败", error);
    return readLegacyData();
  }
}

export async function saveCache(userId = "preview", data) {
  try {
    const db = await getDb();
    await db.put("cache", normalizeData(data), userId);
  } catch (error) {
    console.warn("保存本地缓存失败", error);
  }
}

export async function clearCache(userId) {
  const db = await getDb();
  if (userId) await db.delete("cache", userId);
  else await db.clear("cache");
}

export async function queueMutation(table, operation, row) {
  const db = await getDb();
  const id = `${table}:${row.id}`;
  await db.put("outbox", {
    id,
    table,
    operation,
    row,
    queuedAt: new Date().toISOString()
  });
}

export async function listOutbox() {
  const db = await getDb();
  return db.getAll("outbox");
}

export async function removeOutbox(id) {
  const db = await getDb();
  await db.delete("outbox", id);
}

export async function clearOutbox() {
  const db = await getDb();
  await db.clear("outbox");
}

export async function readLegacyData() {
  const data = normalizeData({});
  const tasks = readJson("now-planner.tasks.v1", []);
  const courses = readJson("now-planner.courses.v1", []).map((course) => ({
    id: legacyUuid(),
    semesterId: null,
    name: course.name,
    weekday: Number(course.weekday) === 0 ? 7 : Number(course.weekday) || 1,
    startTime: course.start,
    endTime: course.end,
    location: course.location || "",
    teacher: "",
    credits: null,
    attribute: "",
    periods: "",
    weekNumbers: null,
    source: "manual",
    sourceKey: null,
    createdAt: new Date(course.createdAt || Date.now()).toISOString(),
    updatedAt: new Date(course.updatedAt || Date.now()).toISOString()
  }));
  const completed = readJson("now-planner.completed.v1", []).map((entry) => ({
    id: legacyUuid(),
    taskId: entry.taskId || null,
    name: entry.name,
    importance: entry.importance || "medium",
    durationMinutes: Number(entry.duration) || 0,
    completedAt: new Date(entry.completedAt || Date.now()).toISOString()
  }));
  const skippedRaw = readJson("now-planner.skipped.v1", { date: "", keys: [] });
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  data.tasks = tasks.map((task) => ({
    id: legacyUuid(),
    name: task.name,
    importance: task.importance || "medium",
    deadline: task.deadline ? new Date(task.deadline).toISOString() : null,
    durationMinutes: Number(task.duration) || 60,
    loweredUntil: task.loweredUntil ? new Date(task.loweredUntil).toISOString() : null,
    createdAt: new Date(task.createdAt || Date.now()).toISOString(),
    updatedAt: new Date(task.updatedAt || Date.now()).toISOString()
  }));
  data.courses = courses;
  data.completed = completed;
  data.skipped = skippedRaw.date === todayKey
    ? skippedRaw.keys.map((key) => ({ id: `legacy:${key}`, itemKey: key, skipDate: todayKey, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }))
    : [];
  return data;
}

export async function backupLegacyData() {
  const legacy = {
    tasks: readJson("now-planner.tasks.v1", []),
    courses: readJson("now-planner.courses.v1", []),
    completed: readJson("now-planner.completed.v1", []),
    skipped: readJson("now-planner.skipped.v1", { date: "", keys: [] })
  };
  localStorage.setItem("now-planner.legacy-backup.v2", JSON.stringify(legacy));
}

export function hasLegacyData() {
  return ["now-planner.tasks.v1", "now-planner.courses.v1", "now-planner.completed.v1", "now-planner.skipped.v1"]
    .some((key) => Boolean(localStorage.getItem(key)));
}

function normalizeData(value) {
  return {
    tasks: Array.isArray(value?.tasks) ? value.tasks : [],
    semesters: Array.isArray(value?.semesters) ? value.semesters : [],
    courses: Array.isArray(value?.courses) ? value.courses : [],
    completed: Array.isArray(value?.completed) ? value.completed : [],
    skipped: Array.isArray(value?.skipped) ? value.skipped : [],
    focusSessions: Array.isArray(value?.focusSessions) ? value.focusSessions : []
  };
}

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export { EMPTY_DATA };

function legacyUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 6)}-4${Math.random().toString(16).slice(2, 5)}-8${Math.random().toString(16).slice(2, 5)}-${Math.random().toString(16).slice(2, 14)}`.slice(0, 36);
}