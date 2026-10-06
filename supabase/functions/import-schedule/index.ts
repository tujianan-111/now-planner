import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type CourseInput = {
  sourceKey: string;
  name: string;
  weekday: number;
  startTime: string;
  endTime: string;
  location?: string;
  teacher?: string;
  credits?: number | null;
  attribute?: string;
  periods?: string;
  weekNumbers?: number[];
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return jsonResponse({ error: "扩展尚未登录，请先输入空间密钥。" }, 401);

    const body = await request.json();
    const semesterInput = body?.semester;
    const coursesInput: CourseInput[] = Array.isArray(body?.courses) ? body.courses : [];
    const partialImport = Boolean(body?.partial);
    if (!semesterInput?.name || !semesterInput?.startDate || !semesterInput?.weekCount) {
      return jsonResponse({ error: "学期信息不完整。" }, 400);
    }
    if (!coursesInput.length) return jsonResponse({ error: "没有解析到可导入的课程。" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return jsonResponse({ error: "登录状态已过期，请重新输入密钥。" }, 401);
    const userId = authData.user.id;
    const semesterKey = String(semesterInput.sourceKey || `${semesterInput.name}|${semesterInput.startDate}`);

    const { data: existingSemester, error: semesterLookupError } = await admin
      .from("semesters")
      .select("id")
      .eq("user_id", userId)
      .eq("source", "jwxt")
      .eq("source_key", semesterKey)
      .maybeSingle();
    if (semesterLookupError) throw semesterLookupError;

    const semesterPayload = {
      user_id: userId,
      name: String(semesterInput.name),
      start_date: semesterInput.startDate,
      week_count: Number(semesterInput.weekCount),
      is_active: true,
      source: "jwxt",
      source_key: semesterKey,
      updated_at: new Date().toISOString()
    };

    let semesterId = existingSemester?.id;
    if (semesterId) {
      const { error } = await admin.from("semesters").update(semesterPayload).eq("id", semesterId);
      if (error) throw error;
    } else {
      const { data, error } = await admin.from("semesters").insert(semesterPayload).select("id").single();
      if (error) throw error;
      semesterId = data.id;
    }

    const { data: existingCourses, error: existingError } = await admin
      .from("courses")
      .select("id, source_key")
      .eq("user_id", userId)
      .eq("semester_id", semesterId)
      .eq("source", "jwxt");
    if (existingError) throw existingError;

    const existingByKey = new Map((existingCourses || []).map((course) => [course.source_key, course.id]));
    const incomingKeys = new Set<string>();
    const rows = coursesInput.map((course) => {
      const sourceKey = String(course.sourceKey);
      incomingKeys.add(sourceKey);
      return {
        id: existingByKey.get(sourceKey) || crypto.randomUUID(),
        user_id: userId,
        semester_id: semesterId,
        name: String(course.name),
        weekday: Number(course.weekday),
        start_time: course.startTime,
        end_time: course.endTime,
        location: String(course.location || ""),
        teacher: String(course.teacher || ""),
        credits: course.credits ?? null,
        attribute: String(course.attribute || ""),
        periods: String(course.periods || ""),
        week_numbers: Array.isArray(course.weekNumbers) ? course.weekNumbers : [],
        source: "jwxt",
        source_key: sourceKey,
        updated_at: new Date().toISOString()
      };
    });

    const { error: upsertError } = await admin.from("courses").upsert(rows, { onConflict: "id" });
    if (upsertError) throw upsertError;

    const staleIds = partialImport ? [] : (existingCourses || [])
      .filter((course) => !incomingKeys.has(course.source_key))
      .map((course) => course.id);
    if (staleIds.length) {
      const { error: deleteError } = await admin.from("courses").delete().in("id", staleIds).eq("user_id", userId);
      if (deleteError) throw deleteError;
    }

    return jsonResponse({
      ok: true,
      semesterId,
      imported: rows.length,
      removed: staleIds.length
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: error instanceof Error ? error.message : "课表导入失败。" }, 500);
  }
});
