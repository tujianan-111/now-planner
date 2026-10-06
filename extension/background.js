import { clearSession, getConfig, getSession, importSchedule, loginWithKey } from "./shared.js";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: error.message || "操作失败。" }));
  return true;
});

async function handleMessage(message) {
  if (message?.type === "GET_STATUS") {
    const [config, session] = await Promise.all([getConfig(), getSession()]);
    return {
      configured: Boolean(config.supabaseUrl && config.supabaseAnonKey),
      loggedIn: Boolean(session?.access_token),
      email: session?.user?.email || ""
    };
  }
  if (message?.type === "LOGIN_KEY") {
    const session = await loginWithKey(message.key);
    return { loggedIn: Boolean(session.access_token) };
  }
  if (message?.type === "LOGOUT") {
    await clearSession();
    return { loggedIn: false };
  }
  if (message?.type === "IMPORT_SCHEDULE") {
    return importSchedule(message.payload);
  }
  if (message?.type === "OPEN_OPTIONS") {
    await chrome.runtime.openOptionsPage();
    return { opened: true };
  }
  throw new Error("未知的扩展操作。");
}
