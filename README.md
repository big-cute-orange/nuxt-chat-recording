# AI 会议纪要助手

基于 Nuxt 4 构建的 AI 会议纪要分析工具，支持多模型对比、行动项提取、第三方集成同步。

## 功能特性

### 核心功能

- **会议分析** — 粘贴会议记录或上传文件（.txt / .docx / .vtt / .srt），AI 自动提取关键信息
- **多模型支持** — DeepSeek、通义千问、豆包三个模型可选
- **对比模式** — 同时运行两个模型并对比结果，AI 裁判自动评分
- **行动项管理** — 自动提取待办事项，支持优先级、负责人、截止日期
- **历史记录** — 所有会议记录持久化存储，支持搜索和回溯
- **数据看板** — 可视化统计图表，分析会议趋势

### 集成能力

- **Notion 同步** — 一键将行动项同步到 Notion 数据库
- **持久化状态** — 刷新页面后自动恢复已同步状态

### 用户系统

- **本地认证** — 用户名/密码注册登录
- **匿名模式** — 未登录用户也可使用，数据独立存储
- **多用户隔离** — 每个用户的数据完全隔离

## 技术栈

- **前端** — Nuxt 4 + Vue 3 + TypeScript
- **后端** — Nitro (Nuxt Server) + H3
- **数据库** — Turso (libSQL) 远程 SQLite
- **ORM** — Drizzle ORM
- **AI 模型** — DeepSeek / 通义千问 / 豆包
- **部署** — Vercel

## 本地开发

### 前置要求

- Node.js 18+
- pnpm (推荐) / npm / yarn

### 安装依赖

```bash
pnpm install
```

### 环境变量配置

复制 `.env.example` 为 `.env`（如果没有示例文件，创建 `.env`）并填写以下配置：

```bash
# ── AI 模型 API Keys ──────────────────────────────────────────────
# 至少配置一个模型的 API Key
DEEPSEEK_API_KEY=sk-...
QWEN_API_KEY=sk-...
DOBAO_API_KEY=ark-...
DOBAO_MODEL_ID=ep-...  # 豆包模型 ID

# ── 数据库 (Turso) ────────────────────────────────────────────────
# 在 https://turso.tech 创建数据库后获取
TURSO_DB_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=eyJhbGc...

# ── 认证 ──────────────────────────────────────────────────────────
# 会话密钥（至少 32 字符），生成方式：
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
NUXT_SESSION_PASSWORD=your-random-64-char-hex-string

# 站点 URL（本地开发用 localhost，生产环境改成实际域名）
NUXT_PUBLIC_SITE_URL=http://localhost:3000

# ── 集成（可选）───────────────────────────────────────────────────
# Notion 集成（在 https://www.notion.so/my-integrations 创建）
NOTION_INTEGRATION_TOKEN=ntn_...
NOTION_DATABASE_ID=...  # 32 位数据库 ID
```

### 数据库迁移

首次运行前需要执行数据库迁移：

```bash
pnpm db:migrate
```

### 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000

## 生产部署

### Vercel 部署（推荐）

1. 将代码推送到 GitHub
2. 在 Vercel 导入项目
3. 配置环境变量（同上，但 `NUXT_PUBLIC_SITE_URL` 改成 Vercel 域名）
4. 部署

### 环境变量检查清单

生产环境必须配置：

- ✅ 至少一个 AI 模型的 API Key
- ✅ `TURSO_DB_URL` 和 `TURSO_AUTH_TOKEN`
- ✅ `NUXT_SESSION_PASSWORD`（使用强随机值，不要用开发环境的）
- ✅ `NUXT_PUBLIC_SITE_URL`（改成实际域名）

可选配置：

- Notion 集成（如果需要同步功能）

### 构建命令

```bash
pnpm build
```

### 预览生产构建

```bash
pnpm preview
```

## 项目结构

```
nuxt-chat-recording/
├── app/
│   ├── components/          # Vue 组件
│   ├── composables/         # 组合式函数
│   ├── pages/               # 页面路由
│   │   ├── index.vue        # 首页（会议分析）
│   │   ├── dashboard.vue    # 数据看板
│   │   ├── integrations.vue # 集成管理
│   │   └── login.vue        # 登录页
│   └── types/               # TypeScript 类型定义
├── server/
│   ├── api/                 # API 端点
│   │   ├── summarize.post.ts      # 单模型分析
│   │   ├── compare.post.ts        # 对比模式
│   │   ├── history/               # 历史记录 CRUD
│   │   ├── action-items/          # 行动项管理
│   │   ├── integrations/          # 集成配置 + Notion 同步
│   │   ├── auth/                  # 认证相关
│   │   └── dashboard/             # 统计数据
│   ├── db/
│   │   ├── schema.ts        # Drizzle 数据库 schema
│   │   └── migrations/      # 数据库迁移文件
│   └── utils/
│       └── db.ts            # 数据库连接单例
├── drizzle.config.ts        # Drizzle 配置
└── nuxt.config.ts           # Nuxt 配置
```

## 数据库 Schema

- `users` — 用户表
- `meetings` — 会议记录
- `action_items` — 行动项（支持外部服务同步）
- `integrations_config` — 集成配置（按用户存储）
- `ai_logs` — AI 调用日志（用于 prompt 版本追踪）
- `judge_results` — 对比模式裁判结果

## 常见问题

### 如何添加新的 AI 模型？

1. 在 `server/api/summarize.post.ts` 和 `compare.post.ts` 中添加模型调用逻辑
2. 在 `app/pages/index.vue` 的 `providers` 数组中添加模型选项
3. 在 `.env` 中添加对应的 API Key

### Notion 同步失败？

1. 检查 `NOTION_INTEGRATION_TOKEN` 是否正确
2. 确认数据库已分享给集成（在 Notion 数据库页面点击"分享" → 添加集成）
3. 检查数据库 ID 是否正确（URL 中 `?` 之前的 32 位字符串）

### 数据库迁移报错？

如果 `pnpm db:migrate` 失败，检查：

- `TURSO_DB_URL` 和 `TURSO_AUTH_TOKEN` 是否正确
- 网络是否能访问 Turso
- 数据库是否已创建

## 开发命令

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build

# 预览生产构建
pnpm preview

# 数据库迁移
pnpm db:migrate

# 生成数据库迁移文件
pnpm db:generate

# 打开 Drizzle Studio（数据库可视化工具）
pnpm db:studio
```

## License

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！
