import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { clientFingerprint, deriveAuthIdentity, enforceRateLimit, sha256, validateKey } from "../_shared/security.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await request.json();
    const validation = validateKey(body?.key);
    const recoveryCode = String(body?.recoveryCode || "").trim();
    if (!validation.valid) return jsonResponse({ error: validation.message }, 400);
    if (!/^RCV-[A-Z2-9-]{20,30}$/i.test(recoveryCode)) return jsonResponse({ error: "恢复码格式不正确。" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    await enforceRateLimit(admin, "create-workspace", clientFingerprint(request), 5, 20);
    const identity = await deriveAuthIdentity(validation.key);
    const { data, error } = await admin.auth.admin.createUser({
      email: identity.email,
      password: identity.password,
      email_confirm: true,
      user_metadata: { planner: true }
    });

    if (error) {
      if (/already|registered|exists/i.test(error.message)) {
        return jsonResponse({ error: "这个密钥已经创建过空间，请直接登录。" }, 409);
      }
      throw error;
    }

    const recoveryHash = await sha256(recoveryCode.toUpperCase());
    const { error: profileError } = await admin.from("profiles").insert({
      id: data.user.id,
      recovery_hash: recoveryHash
    });

    if (profileError) {
      await admin.auth.admin.deleteUser(data.user.id);
      throw profileError;
    }

    return jsonResponse({ userId: data.user.id });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: error instanceof Error ? error.message : "创建空间失败。" }, 500);
  }
});
