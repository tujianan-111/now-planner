# 此刻 · 智能任务规划 v2

“此刻”是一款米白茶绿风格的个人智能任务规划器。当前版本支持密钥登录、Supabase 跨设备同步、离线操作队列，以及强智教务系统完整课表导入。

## 功能

- 打开页面直接展示当前最该完成的任务
- 固定课程、截止时间和重要等级自动排序
- 任务新增、编辑、删除、完成、跳过和临时降级
- 自定义空间密钥登录，每个密钥对应独立数据空间
- 一次性恢复码重置密钥
- Supabase 实时同步和 IndexedDB 离线队列
- PWA 安装、移动端和桌面端响应式布局
- Edge/Chrome 扩展从 `61.131.228.75/jsxsd` 导入 1–20 周完整课表
- 教务重复导入时更新来源课程并保留手动课程

## 本地开发

环境需要 Node.js 22+ 和 pnpm。

```bash
pnpm install
pnpm dev
```

未配置 Supabase 时，登录页会显示“进入本地预览”，数据只写入当前浏览器。

生产构建：

```bash
pnpm build
pnpm preview
```

运行测试：

```bash
pnpm test
```

## Supabase 配置

1. 在 Supabase 创建免费项目，建议选择距离中国大陆较近的区域。
2. 在 SQL Editor 执行 `supabase/migrations/001_init.sql`。
3. 安装 Supabase CLI 并登录：

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

4. 部署 Edge Functions：

```bash
supabase functions deploy create-workspace --no-verify-jwt
supabase functions deploy recover-workspace --no-verify-jwt
supabase functions deploy rotate-key
supabase functions deploy import-schedule
```

`SUPABASE_URL`、`SUPABASE_ANON_KEY` 和 `SUPABASE_SERVICE_ROLE_KEY` 由 Supabase Hosted Functions 自动提供。服务角色密钥不会进入前端。

5. 本地创建 `.env.local`：

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

## GitHub Pages 部署

1. 创建公开 GitHub 仓库。
2. 推送本项目到 `main` 分支。
3. 在仓库 `Settings → Secrets and variables → Actions` 添加：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. 在 `Settings → Pages` 中选择 `GitHub Actions`。
5. 推送后，`.github/workflows/deploy.yml` 会自动构建和发布。

## 浏览器扩展

扩展目录：`extension/`

生成可分发 ZIP：

```bash
pnpm package:extension
```

生成文件位于 `dist/now-planner-extension.zip`。也可以在本地开发模式直接把 `extension/` 目录加载为未打包扩展。

1. 打开 `edge://extensions` 或 `chrome://extensions`。
2. 开启“开发者模式”。
3. 点击“加载解压缩的扩展”，选择本项目的 `extension` 目录。
4. 打开扩展设置，填写 Supabase 项目地址、匿名公钥和网页地址。
5. 登录教务系统并打开“我的课表”。
6. 点击右下角“导入到此刻”，输入空间密钥，确认导入。

扩展只申请 `http://61.131.228.75/*` 和 `https://*.supabase.co/*` 权限。导入时会遍历周次调用 `/jsxsd/framework/main_index_loadkb.jsp`，合并相同课程的周次，并在确认后写入云端。

## 数据安全

- 服务端不保存明文空间密钥。
- 密钥通过 SHA-256 派生隐藏登录标识，Supabase Auth 负责密码哈希。
- 恢复码为一次性随机值，重置后会生成新的恢复码。
- 所有业务表启用 RLS，只能访问自身 `user_id` 的数据。
- Supabase 服务角色密钥仅用于 Edge Functions。
