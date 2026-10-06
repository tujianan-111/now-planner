import { getConfig } from "./shared.js";

const status = document.getElementById("status");

async function render() {
  const response = await message({ type: "GET_STATUS" });
  const config = await getConfig();
  if (!response.ok) {
    status.innerHTML = "<b>扩展状态异常</b><span>请重新加载扩展。</span>";
    return;
  }
  const data = response.data;
  if (!data.configured) {
    status.innerHTML = "<b>尚未配置云端</b><span>打开设置，填写 Supabase 地址和匿名公钥。</span>";
  } else if (!data.loggedIn) {
    status.innerHTML = "<b>尚未登录</b><span>请到教务课表页面点击“导入到此刻”并输入空间密钥。</span>";
  } else {
    status.innerHTML = "<b>已连接此刻云端</b><span>课表导入会话有效。打开教务页面即可导入。</span>";
  }
}

document.getElementById("openOptions").addEventListener("click", () => chrome.runtime.openOptionsPage());
document.getElementById("openApp").addEventListener("click", async () => {
  const config = await getConfig();
  if (config.appUrl) chrome.tabs.create({ url: config.appUrl });
});
document.getElementById("logout").addEventListener("click", async () => {
  await message({ type: "LOGOUT" });
  render();
});

function message(payload) {
  return new Promise((resolve) => chrome.runtime.sendMessage(payload, (response) => resolve(response || { ok: false })));
}

render();
