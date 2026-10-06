import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

export const isCloudConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_URL.includes("your-project")
);

export const supabase = isCloudConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    })
  : null;

export function normalizeKey(value) {
  return String(value ?? "").normalize("NFC").trim();
}

export function validateKey(value) {
  const key = normalizeKey(value);
  if ([...key].length < 8) return { valid: false, message: "密钥至少需要 8 个字符。" };
  if ([...key].length > 128) return { valid: false, message: "密钥不能超过 128 个字符。" };
  return { valid: true, key, message: "" };
}

export function keyStrength(value) {
  const key = normalizeKey(value);
  if (!key) return { score: 0, label: "未输入" };
  let score = 0;
  if ([...key].length >= 8) score += 1;
  if ([...key].length >= 12) score += 1;
  if (/[a-z]/.test(key) && /[A-Z]/.test(key)) score += 1;
  if (/\d/.test(key) && /[^a-zA-Z0-9]/.test(key)) score += 1;
  score = Math.min(4, score);
  return { score, label: ["很弱", "偏弱", "尚可", "较强", "很强"][score] };
}

export async function deriveAuthIdentity(keyValue) {
  const key = normalizeKey(keyValue);
  const bytes = new TextEncoder().encode(key);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return {
    email: `key-${hash.slice(0, 32)}@example.com`,
    password: key,
    hash
  };
}

export function generateRecoveryCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const value = [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
  return `RCV-${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}`;
}

export async function signInWithKey(keyValue) {
  if (!supabase) throw new Error("当前版本未配置 Supabase，可先进入本地预览模式。");
  const identity = await deriveAuthIdentity(keyValue);
  const { data, error } = await supabase.auth.signInWithPassword({ email: identity.email, password: identity.password });
  if (error) throw new Error(error.message || "密钥验证失败。请检查后重试。");
  return data.session;
}

export async function createWorkspace(keyValue) {
  if (!supabase) throw new Error("当前版本未配置 Supabase。");
  const key = normalizeKey(keyValue);
  const recoveryCode = generateRecoveryCode();
  const { data, error } = await supabase.functions.invoke("create-workspace", {
    body: { key, recoveryCode }
  });
  if (error) throw new Error(await functionErrorMessage(error, "创建空间失败。请稍后重试。"));
  await signInWithKey(key);
  return { recoveryCode, userId: data?.userId || null };
}

export async function recoverWorkspace(recoveryCode, newKeyValue) {
  if (!supabase) throw new Error("当前版本未配置 Supabase。");
  const newKey = normalizeKey(newKeyValue);
  const { data, error } = await supabase.functions.invoke("recover-workspace", {
    body: { recoveryCode: String(recoveryCode || "").trim(), newKey }
  });
  if (error) throw new Error(await functionErrorMessage(error, "恢复码验证失败。"));
  await signInWithKey(newKey);
  return { recoveryCode: data?.recoveryCode || "" };
}

export async function rotateWorkspaceKey(currentKeyValue, newKeyValue) {
  if (!supabase) throw new Error("当前版本未配置 Supabase。");
  const currentKey = normalizeKey(currentKeyValue);
  const newKey = normalizeKey(newKeyValue);
  await signInWithKey(currentKey);
  const { error } = await supabase.functions.invoke("rotate-key", { body: { newKey } });
  if (error) throw new Error(await functionErrorMessage(error, "更换密钥失败。"));
  await signInWithKey(newKey);
}


export async function createScheduleShare(semesterId) {
  if (!supabase) throw new Error("当前版本未配置 Supabase。");
  const { data, error } = await supabase.functions.invoke("share-schedule", {
    body: { action: "create", semesterId }
  });
  if (error) throw new Error(await functionErrorMessage(error, "生成分享码失败。"));
  return data;
}

export async function claimScheduleShare(code) {
  if (!supabase) throw new Error("当前版本未配置 Supabase。");
  const { data, error } = await supabase.functions.invoke("share-schedule", {
    body: { action: "claim", code: String(code || "").trim().toUpperCase() }
  });
  if (error) throw new Error(await functionErrorMessage(error, "复制课表失败。"));
  return data;
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session || null;
}

async function functionErrorMessage(error, fallback) {
  try {
    if (error?.context?.json) {
      const payload = await error.context.json();
      return payload?.error || fallback;
    }
  } catch {
    // Ignore response parsing errors and use the fallback.
  }
  return error?.message || fallback;
}
