export function normalizeKey(value: unknown) {
  return String(value ?? "").normalize("NFC").trim();
}

export function validateKey(value: unknown) {
  const key = normalizeKey(value);
  const length = [...key].length;
  if (length < 8) return { valid: false, message: "密钥至少需要 8 个字符。" };
  if (length > 128) return { valid: false, message: "密钥不能超过 128 个字符。" };
  return { valid: true, key, message: "" };
}

export async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function deriveAuthIdentity(key: string) {
  const hash = await sha256(key);
  return {
    email: `key-${hash.slice(0, 32)}@example.com`,
    password: key,
    hash
  };
}

export async function enforceRateLimit(
  admin: { from: (table: string) => any },
  action: string,
  fingerprint: string,
  maxAttempts = 8,
  windowMinutes = 10
) {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const { count, error } = await admin
    .from("auth_attempts")
    .select("id", { count: "exact", head: true })
    .eq("action", action)
    .eq("fingerprint", fingerprint)
    .gte("created_at", since);

  if (error) throw error;
  if ((count || 0) >= maxAttempts) {
    throw new Error("操作过于频繁，请稍后再试。");
  }

  const { error: insertError } = await admin.from("auth_attempts").insert({ action, fingerprint });
  if (insertError) throw insertError;
}

export function clientFingerprint(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("cf-connecting-ip")
    || "unknown";
}
