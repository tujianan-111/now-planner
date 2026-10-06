import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { clientFingerprint, deriveAuthIdentity, enforceRateLimit, sha256, validateKey } from "../_shared/security.ts";

function newRecoveryCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const value = [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
  return `RCV-${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await request.json();
    const recoveryCode = String(body?.recoveryCode || "").trim().toUpperCase();
    const validation = validateKey(body?.newKey);
    if (!/^RCV-[A-Z2-9-]{20,30}$/.test(recoveryCode)) return jsonResponse({ error: "恢复码格式不正确。" }, 400);
    if (!validation.valid) return jsonResponse({ error: validation.message }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    await enforceRateLimit(admin, "recover-workspace", clientFingerprint(request), 8, 20);
    const recoveryHash = await sha256(recoveryCode);
    const { data: profile, error: lookupError } = await admin
      .from("profiles")
      .select("id, recovery_used_at")
      .eq("recovery_hash", recoveryHash)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!profile || profile.recovery_used_at) return jsonResponse({ error: "恢复码无效或已经使用。" }, 400);

    const identity = await deriveAuthIdentity(validation.key);
    const nextRecoveryCode = newRecoveryCode();
    const nextRecoveryHash = await sha256(nextRecoveryCode);
    const { error: updateUserError } = await admin.auth.admin.updateUserById(profile.id, {
      email: identity.email,
      password: identity.password,
      email_confirm: true
    });
    if (updateUserError) throw updateUserError;

    const { error: profileError } = await admin
      .from("profiles")
      .update({
        recovery_hash: nextRecoveryHash,
        recovery_used_at: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", profile.id);
    if (profileError) throw profileError;

    return jsonResponse({ userId: profile.id, recoveryCode: nextRecoveryCode });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: error instanceof Error ? error.message : "恢复失败。" }, 500);
  }
});
