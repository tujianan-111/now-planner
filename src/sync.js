import { getDateKey } from "./utils.js";
import { backupLegacyData, hasLegacyData, listOutbox, loadCache, queueMutation, readLegacyData, removeOutbox, saveCache } from "./db.js";

const TABLES = ["semesters", "tasks", "courses", "completed", "skipped", "focusSessions"];

export class PlannerSync {
  constructor({ supabase, userId = "preview", mode = "preview", onData, onStatus }) {
    this.supabase = supabase;
    this.userId = userId;
    this.mode = mode;
    this.onData = onData || (() => {});
    this.onStatus = onStatus || (() => {});
    this.data = { tasks: [], semesters: [], courses: [], completed: [], skipped: [], focusSessions: [] };
    this.channel = null;
    this.flushing = false;
    this.destroyed = false;
  }

  async init() {
    this.setStatus("syncing", "正在载入");
    this.data = await loadCache(this.userId);
    this.emit();

    if (this.mode !== "cloud" || !this.supabase) {
      await saveCache(this.userId, this.data);
      this.setStatus("ready", "本地预览");
      return this.data;
    }

    this.subscribe();
    await this.flushOutbox();
    await this.pullAll();
    await this.migrateLegacyIfNeeded();

    if (navigator.onLine) {
      this.setStatus("ready", "已同步");
    } else {
      this.setStatus("offline", "离线中");
    }
    return this.data;
  }

  async pullAll() {
    if (this.mode !== "cloud" || !this.supabase || !navigator.onLine) return;
    this.setStatus("syncing", "正在同步");
    const pending = new Set((await listOutbox()).map((item) => item.id));

    try {
      const [semesters, tasks, courses, completed, skipped, focusSessions] = await Promise.all([
        this.supabase.from("semesters").select("*"),
        this.supabase.from("tasks").select("*"),
        this.supabase.from("courses").select("*"),
        this.supabase.from("completed_tasks").select("*"),
        this.supabase.from("skipped_items").select("*").eq("skip_date", getDateKey()),
        this.supabase.from("focus_sessions").select("*")
      ]);

      const responses = { semesters, tasks, courses, completed, skipped, focusSessions };
      TABLES.forEach((table) => {
        const response = responses[table];
        if (response.error) throw response.error;
        const remote = (response.data || []).map((row) => this.fromRow(table, row)).filter(Boolean);
        const pendingRows = this.data[table].filter((item) => pending.has(`${table}:${item.id}`));
        const localMap = new Map(remote.map((item) => [item.id, item]));
        pendingRows.forEach((item) => localMap.set(item.id, item));
        this.data[table] = [...localMap.values()];
      });

      await saveCache(this.userId, this.data);
      this.emit();
      this.setStatus("ready", "已同步");
    } catch (error) {
      console.warn("云端同步失败", error);
      this.setStatus("error", "同步失败");
    }
  }

  async mutate(table, operation, row) {
    const id = row.id;
    if (!id) throw new Error("同步记录缺少 id。");
    this.applyLocal(table, operation, row);
    await saveCache(this.userId, this.data);

    if (this.mode !== "cloud" || !this.supabase) return;

    await queueMutation(table, operation, row);
    if (navigator.onLine) await this.flushOutbox();
    else this.setStatus("offline", "等待联网");
  }

  async flushOutbox() {
    if (this.flushing || this.mode !== "cloud" || !this.supabase || !navigator.onLine) return;
    this.flushing = true;
    this.setStatus("syncing", "正在同步");

    try {
      const entries = await listOutbox();
      for (const entry of entries) {
        if (entry.operation === "delete") {
          const { error } = await this.supabase.from(entry.table).delete().eq("id", entry.row.id);
          if (error) throw error;
        } else {
          const payload = this.toRow(entry.table, entry.row);
          const { error } = await this.supabase.from(entry.table).upsert(payload, { onConflict: "id" });
          if (error) throw error;
        }
        await removeOutbox(entry.id);
      }
      this.setStatus("ready", "已同步");
    } catch (error) {
      console.warn("待同步操作上传失败", error);
      this.setStatus(navigator.onLine ? "error" : "offline", navigator.onLine ? "同步失败" : "离线中");
    } finally {
      this.flushing = false;
    }
  }

  async migrateLegacyIfNeeded() {
    if (!hasLegacyData()) return;
    const migrationKey = `now-planner.migrated.${this.userId}`;
    if (localStorage.getItem(migrationKey)) return;

    backupLegacyData();
    const legacy = await readLegacyData();
    const payloads = [];
    TABLES.forEach((table) => {
      legacy[table].forEach((item) => payloads.push({ table, row: item }));
    });

    try {
      for (const payload of payloads) {
        const normalized = { ...payload.row, userId: this.userId };
        const { error } = await this.supabase.from(payload.table).upsert(this.toRow(payload.table, normalized), { onConflict: "id" });
        if (error) throw error;
      }
      localStorage.setItem(migrationKey, new Date().toISOString());
      await this.pullAll();
    } catch (error) {
      console.warn("旧数据迁移失败", error);
      this.setStatus("error", "旧数据待迁移");
    }
  }

  subscribe() {
    if (!this.supabase || this.channel) return;
    this.channel = this.supabase
      .channel(`planner:${this.userId}`)
      .on("postgres_changes", { event: "*", schema: "public", filter: `user_id=eq.${this.userId}` }, (payload) => {
        const table = tableFromRemoteName(payload.table);
        if (!table) return;
        if (payload.eventType === "DELETE") {
          this.applyLocal(table, "delete", { id: payload.old.id });
        } else {
          const row = this.fromRow(table, payload.new);
          if (row) this.applyLocal(table, "upsert", row);
        }
        saveCache(this.userId, this.data);
        this.emit();
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") this.setStatus("error", "实时连接异常");
      });
  }

  applyLocal(table, operation, row) {
    if (!this.data[table]) return;
    if (operation === "delete") {
      this.data[table] = this.data[table].filter((item) => item.id !== row.id);
    } else {
      const index = this.data[table].findIndex((item) => item.id === row.id);
      if (index >= 0) this.data[table][index] = row;
      else this.data[table].push(row);
    }
    this.emit();
  }

  replaceData(data) {
    this.data = {
      tasks: data.tasks || [],
      semesters: data.semesters || [],
      courses: data.courses || [],
      completed: data.completed || [],
      skipped: data.skipped || [],
      focusSessions: data.focusSessions || []
    };
    saveCache(this.userId, this.data);
    this.emit();
  }

  exportData() {
    return JSON.parse(JSON.stringify({
      exportedAt: new Date().toISOString(),
      version: 2,
      workspace: this.userId,
      ...this.data
    }));
  }

  emit() {
    if (!this.destroyed) this.onData(this.data);
  }

  setStatus(state, text) {
    if (!this.destroyed) this.onStatus({ state, text, lastSyncAt: new Date().toISOString() });
  }

  fromRow(table, row) {
    if (!row) return null;
    if (table === "tasks") {
      return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        importance: row.importance,
        deadline: row.deadline,
        durationMinutes: Number(row.duration_minutes || 60),
        loweredUntil: row.lowered_until,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    }
    if (table === "semesters") {
      return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        startDate: row.start_date,
        weekCount: Number(row.week_count || 20),
        isActive: Boolean(row.is_active),
        source: row.source || "manual",
        createdAt: row.created_at,
        sourceKey: row.source_key || null,
        updatedAt: row.updated_at
      };
    }
    if (table === "courses") {
      return {
        id: row.id,
        userId: row.user_id,
        semesterId: row.semester_id,
        name: row.name,
        weekday: Number(row.weekday),
        startTime: String(row.start_time || "").slice(0, 5),
        endTime: String(row.end_time || "").slice(0, 5),
        location: row.location || "",
        teacher: row.teacher || "",
        credits: row.credits == null ? null : Number(row.credits),
        attribute: row.attribute || "",
        periods: row.periods || "",
        weekNumbers: Array.isArray(row.week_numbers) ? row.week_numbers.map(Number) : null,
        source: row.source || "manual",
        sourceKey: row.source_key || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    }
    if (table === "completed") {
      return {
        id: row.id,
        userId: row.user_id,
        taskId: row.task_id,
        name: row.name,
        importance: row.importance,
        durationMinutes: Number(row.duration_minutes || 0),
        completedAt: row.completed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    }
    if (table === "focusSessions") {
      return {
        id: row.id,
        userId: row.user_id,
        taskId: row.task_id,
        taskName: row.task_name,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        plannedSeconds: Number(row.planned_seconds || 1500),
        focusedSeconds: Number(row.focused_seconds || 0),
        finishReason: row.finish_reason || "completed",
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    }
    if (table === "skipped") {
      return {
        id: row.id,
        userId: row.user_id,
        itemKey: row.item_key,
        skipDate: row.skip_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    }
    return null;
  }

  toRow(table, item) {
    const base = {
      id: item.id,
      user_id: this.userId,
      updated_at: item.updatedAt || new Date().toISOString()
    };
    if (table === "tasks") {
      return {
        ...base,
        name: item.name,
        importance: item.importance,
        deadline: item.deadline || null,
        duration_minutes: item.durationMinutes,
        lowered_until: item.loweredUntil || null,
        created_at: item.createdAt || new Date().toISOString()
      };
    }
    if (table === "semesters") {
      return {
        ...base,
        name: item.name,
        start_date: item.startDate,
        week_count: item.weekCount,
        is_active: Boolean(item.isActive),
        source: item.source || "manual",
        source_key: item.sourceKey || null,
        created_at: item.createdAt || new Date().toISOString()
      };
    }
    if (table === "courses") {
      return {
        ...base,
        semester_id: item.semesterId || null,
        name: item.name,
        weekday: item.weekday,
        start_time: item.startTime,
        end_time: item.endTime,
        location: item.location || "",
        teacher: item.teacher || "",
        credits: item.credits,
        attribute: item.attribute || "",
        periods: item.periods || "",
        week_numbers: item.weekNumbers,
        source: item.source || "manual",
        source_key: item.sourceKey || null,
        created_at: item.createdAt || new Date().toISOString()
      };
    }
    if (table === "completed") {
      return {
        ...base,
        task_id: item.taskId || null,
        name: item.name,
        importance: item.importance,
        duration_minutes: item.durationMinutes,
        completed_at: item.completedAt || new Date().toISOString(),
        created_at: item.createdAt || new Date().toISOString()
      };
    }
    if (table === "focusSessions") {
      return {
        ...base,
        task_id: item.taskId || null,
        task_name: item.taskName,
        started_at: item.startedAt,
        ended_at: item.endedAt || new Date().toISOString(),
        planned_seconds: item.plannedSeconds,
        focused_seconds: item.focusedSeconds,
        finish_reason: item.finishReason || "completed",
        created_at: item.createdAt || new Date().toISOString()
      };
    }
    if (table === "skipped") {
      return {
        ...base,
        item_key: item.itemKey,
        skip_date: item.skipDate,
        created_at: item.createdAt || new Date().toISOString()
      };
    }
    throw new Error(`未知数据表：${table}`);
  }

  destroy() {
    this.destroyed = true;
    if (this.channel && this.supabase) this.supabase.removeChannel(this.channel);
  }
}

function tableFromRemoteName(value) {
  return { semesters: "semesters", tasks: "tasks", courses: "courses", completed_tasks: "completed", skipped_items: "skipped", focus_sessions: "focusSessions" }[value] || null;
}
