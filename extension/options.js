import { getConfig, saveConfig } from "./shared.js";

const form = document.getElementById("configForm");
const status = document.getElementById("status");

const config = await getConfig();
document.getElementById("supabaseUrl").value = config.supabaseUrl || "";
document.getElementById("supabaseAnonKey").value = config.supabaseAnonKey || "";
document.getElementById("appUrl").value = config.appUrl || "";

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveConfig({
    supabaseUrl: document.getElementById("supabaseUrl").value,
    supabaseAnonKey: document.getElementById("supabaseAnonKey").value,
    appUrl: document.getElementById("appUrl").value
  });
  status.textContent = "已保存。";
  window.setTimeout(() => { status.textContent = ""; }, 2400);
});
