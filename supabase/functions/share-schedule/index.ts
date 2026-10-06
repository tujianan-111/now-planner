import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `CLASS-${[...bytes].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("")}`;
}

async function authenticatedUser(admin: any, request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error) return null;
  return data.user || null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const user = await authenticatedUser(admin, request);
    if (!user) return jsonResponse({ error: "登录状态已过期，请重新登录。" }, 401);

    const body = await request.json();
    const action = String(body?.action || "create");

    if (action === "create") {
      const semesterId = String(body?.semesterId || "");
      const { data: semester, error: semesterError } = await admin
        .from("semesters")
        .select("id, name")
        .eq("id", semesterId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (semesterError) throw semesterError;
      if (!semester) return jsonResponse({ error: "没有找到可分享的课表。" }, 404);

      let code = "";
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const candidate = makeCode();
        const { data: existing } = await admin.from("schedule_shares").select("id").eq("code", candidate).maybeSingle();
        if (!existing) { code = candidate; break; }
      }
      if (!code) throw new Error("分享码生成失败，请重试。");

      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await admin
        .from("schedule_shares")
        .insert({ owner_id: user.id, semester_id: semester.id, code, max_uses: 20, expires_at: expiresAt })
        .select("id, code, expires_at")
        .single();
      if (error) throw error;
      return jsonResponse({ shareId: data.id, code: data.code, expiresAt: data.expires_at, semesterName: semester.name });
    }

    if (action === "claim") {
      const code = String(body?.code || "").trim().toUpperCase();
      if (!/^CLASS-[A-Z2-9]{8}$/.test(code)) return jsonResponse({ error: "分享码格式不正确。" }, 400);

      const { data: share, error: shareError } = await admin
        .from("schedule_shares")
        .select("id, owner_id, semester_id, max_uses, uses, expires_at")
        .eq("code", code)
        .maybeSingle();
      if (shareError) throw shareError;
      if (!share) return jsonResponse({ error: "分享码不存在。" }, 404);
      if (new Date(share.expires_at).getTime() < Date.now()) return jsonResponse({ error: "分享码已经过期。" }, 410);
      if (share.uses >= share.max_uses) return jsonResponse({ error: "分享码使用次数已达上限。" }, 410);
      if (share.owner_id === user.id) return jsonResponse({ error: "不能复制自己创建的课表。" }, 400);

      const sharedSourceKey = `shared:${share.id}`;
      const { data: existingCopy } = await admin
        .from("semesters")
        .select("id")
        .eq("user_id", user.id)
        .eq("source_key", sharedSourceKey)
        .maybeSingle();
      if (existingCopy) return jsonResponse({ error: "你已经复制过这份课表。" }, 409);

      const { data: sourceSemester, error: sourceSemesterError } = await admin
        .from("semesters")
        .select("name, start_date, week_count, is_active")
        .eq("id", share.semester_id)
        .single();
      if (sourceSemesterError) throw sourceSemesterError;

      const { data: sourceCourses, error: sourceCoursesError } = await admin
        .from("courses")
        .select("name, weekday, start_time, end_time, location, teacher, credits, attribute, periods, week_numbers")
        .eq("semester_id", share.semester_id)
        .eq("user_id", share.owner_id);
      if (sourceCoursesError) throw sourceCoursesError;

      const semesterId = crypto.randomUUID();
      const { error: semesterInsertError } = await admin.from("semesters").insert({
        id: semesterId,
        user_id: user.id,
        name: sourceSemester.name,
        start_date: sourceSemester.start_date,
        week_count: sourceSemester.week_count,
        is_active: sourceSemester.is_active,
        source: "jwxt",
        source_key: sharedSourceKey
      });
      if (semesterInsertError) throw semesterInsertError;

      const rows = (sourceCourses || []).map((course) => ({
        id: crypto.randomUUID(),
        user_id: user.id,
        semester_id: semesterId,
        name: course.name,
        weekday: course.weekday,
        start_time: course.start_time,
        end_time: course.end_time,
        location: course.location || "",
        teacher: course.teacher || "",
        credits: course.credits,
        attribute: course.attribute || "",
        periods: course.periods || "",
        week_numbers: course.week_numbers || [],
        source: "jwxt",
        source_key: `${share.id}:${course.name}:${course.weekday}:${course.start_time}`.slice(0, 180)
      }));
      if (rows.length) {
        const { error: coursesInsertError } = await admin.from("courses").insert(rows);
        if (coursesInsertError) throw coursesInsertError;
      }

      const { error: useError } = await admin
        .from("schedule_shares")
        .update({ uses: share.uses + 1 })
        .eq("id", share.id)
        .eq("uses", share.uses);
      if (useError) throw useError;

      return jsonResponse({ ok: true, semesterId, courses: rows.length, semesterName: sourceSemester.name });
    }

    return jsonResponse({ error: "未知的分享操作。" }, 400);
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: error instanceof Error ? error.message : "课表分享失败。" }, 500);
  }
});
