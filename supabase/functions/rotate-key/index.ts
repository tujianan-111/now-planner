import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { deriveAuthIdentity, enforceRateLimit, validateKey } from "../_shared/security.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return jsonResponse({ error: "登录状态无效，请重新登录。" }, 401);

    const body = await request.json();
    const validation = validateKey(body?.newKey);
    if (!validation.valid) return jsonResponse({ error: validation.message }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return jsonResponse({ error: "登录状态已过期，请重新登录。" }, 401);

    await enforceRateLimit(admin, "rotate-key", authData.user.id, 5, 20);
    const identity = await deriveAuthIdentity(validation.key);
    const { error } = await admin.auth.admin.updateUserById(authData.user.id, {
      email: identity.email,
      password: identity.password,
      email_confirm: true
    });
    if (error) throw error;

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: error instanceof Error ? error.message : "更换密钥失败。" }, 500);
  }
});
