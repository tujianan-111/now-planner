export const DEFAULT_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  appUrl: "https://your-name.github.io/now-planner/"
};

export async function getConfig() {
  const stored = await chrome.storage.local.get(["supabaseUrl", "supabaseAnonKey", "appUrl"]);
  return { ...DEFAULT_CONFIG, ...stored };
}

export async function saveConfig(config) {
  await chrome.storage.local.set({
    supabaseUrl: String(config.supabaseUrl || "").trim().replace(/\/+$/, ""),
    supabaseAnonKey: String(config.supabaseAnonKey || "").trim(),
    appUrl: String(config.appUrl || "").trim()
  });
}

export function normalizeKey(value) {
  return String(value ?? "").normalize("NFC").trim();
}

export async function deriveAuthIdentity(keyValue) {
  const key = normalizeKey(keyValue);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return { email: `key-${hash.slice(0, 32)}@example.com`, password: key };
}

export async function getSession() {
  const { plannerSession } = await chrome.storage.local.get("plannerSession");
  return plannerSession || null;
}

export async function clearSession() {
  await chrome.storage.local.remove("plannerSession");
}

export async function loginWithKey(keyValue) {
  const config = await getConfig();
  if (!config.supabaseUrl || !config.supabaseAnonKey) throw new Error("请先在扩展设置中填写 Supabase 地址和匿名公钥。");
  const identity = await deriveAuthIdentity(keyValue);
  const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": config.supabaseAnonKey
    },
    body: JSON.stringify({ email: identity.email, password: identity.password })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error_description || payload.msg || "密钥验证失败。");
  const session = normalizeSession(payload);
  await chrome.storage.local.set({ plannerSession: session });
  return session;
}

export async function ensureAccessToken() {
  const session = await getSession();
  if (!session?.access_token) throw new Error("AUTH_REQUIRED");
  const expiresAt = Number(session.expires_at || 0) * 1000;
  if (expiresAt && expiresAt - Date.now() > 60_000) return session.access_token;

  const config = await getConfig();
  const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": config.supabaseAnonKey
    },
    body: JSON.stringify({ refresh_token: session.refresh_token })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    await clearSession();
    throw new Error("AUTH_REQUIRED");
  }
  const next = normalizeSession(payload);
  await chrome.storage.local.set({ plannerSession: next });
  return next.access_token;
}

export async function importSchedule(payload) {
  const config = await getConfig();
  if (!config.supabaseUrl || !config.supabaseAnonKey) throw new Error("CONFIG_REQUIRED");
  const token = await ensureAccessToken();
  const response = await fetch(`${config.supabaseUrl}/functions/v1/import-schedule`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": config.supabaseAnonKey,
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      await clearSession();
      throw new Error("AUTH_REQUIRED");
    }
    throw new Error(result.error || "课表导入失败。");
  }
  return result;
}

function normalizeSession(payload) {
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_at: payload.expires_at || Math.floor(Date.now() / 1000) + Number(payload.expires_in || 3600),
    user: payload.user || null
  };
}
