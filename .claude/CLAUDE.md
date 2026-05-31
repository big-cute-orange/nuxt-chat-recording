# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI 会议纪要助手 — A Nuxt 4 application for AI-powered meeting transcript analysis with multi-model comparison, action item extraction, and third-party integrations (Notion).

**Tech Stack**: Nuxt 4 + Vue 3 + TypeScript (frontend), Nitro + H3 (backend), Turso/libSQL (database), Drizzle ORM, OpenAI-compatible APIs (DeepSeek, Qwen, Doubao)

## Development Commands

```bash
# Development
pnpm dev                 # Start dev server at http://localhost:3000

# Database
pnpm db:migrate          # Run migrations (required before first run)
pnpm db:generate         # Generate new migration from schema changes
pnpm db:studio           # Open Drizzle Studio (visual DB browser)

# Build & Deploy
pnpm build               # Production build
pnpm build:vercel        # Vercel build (runs migrations first)
pnpm preview             # Preview production build locally

# Code Quality
pnpm lint                # Run ESLint
pnpm lint:fix            # Auto-fix ESLint issues
pnpm lint:css            # Run Stylelint
pnpm lint:css:fix        # Auto-fix Stylelint issues
pnpm format              # Format with Prettier + fix linters
```

## Architecture

### Database Schema & User Model

- **Multi-tenancy**: All tables use `userId` foreign keys for data isolation. Anonymous users (not logged in) get `userId: null` and data stored in browser localStorage.
- **Authentication**: Local username/password via `nuxt-auth-utils`. Session managed server-side with encrypted cookies.
- **Schema location**: [server/db/schema.ts](server/db/schema.ts) — uses Drizzle ORM with SQLite dialect (Turso in production, local file in dev).
- **Database singleton**: [server/utils/db.ts](server/utils/db.ts) exports `useDb()` — reused across all requests. Auto-falls back to `file:./data/minutai.db` when `TURSO_DB_URL` is unset or placeholder.

**Key tables**:
- `users` — Local auth users (username/passwordHash)
- `meetings` — Transcript + AI summary (JSON-serialized `IMeetingSummary`). Supports `mode: 'single' | 'compare'`.
- `action_items` — Extracted tasks with external service sync tracking (`externalService`, `externalServiceId`, `externalUrl`)
- `integrations_config` — Per-user credentials for Notion/Jira/Linear (JSON config blob)
- `ai_logs` — Every AI call logged with `promptVersion`, `rawOutput`, `validationPassed` for prompt iteration tracking
- `judge_results` — LLM-as-judge scores when comparing two models

### API Structure

All endpoints in [server/api/](server/api/):

- **AI Processing**:
  - `POST /api/summarize` — Single-model analysis (streaming SSE response)
  - `POST /api/compare` — Dual-model comparison (parallel streaming)
  - `POST /api/judge` — LLM-as-judge evaluation of compare results
  - `POST /api/transcribe` — File upload (.txt/.docx/.vtt/.srt) → text extraction

- **CRUD**:
  - `GET /api/history` — List meetings (filtered by userId)
  - `POST /api/history` — Save meeting + action items (transactional)
  - `GET /api/history/[id]` — Single meeting detail
  - `PATCH /api/history/[id]` — Update meeting
  - `DELETE /api/history/[id]` — Delete meeting (cascades to action_items)
  - `POST /api/history/bulk` — Bulk delete meetings
  - `GET /api/action-items` — List action items
  - `POST /api/action-items` — Create action item
  - `PATCH /api/action-items/[id]` — Update action item

- **Integrations**:
  - `GET /api/integrations/config` — Fetch user's integration configs
  - `PUT /api/integrations/config` — Save/update integration config
  - `POST /api/integrations/notion` — Sync action items to Notion database
  - `POST /api/integrations/notion/test` — Test Notion connection

- **Auth**:
  - `POST /api/auth/register` — Create local user
  - `POST /api/auth/login` — Login (sets session cookie)
  - `POST /api/auth/logout` — Clear session
  - `GET /api/auth/session` — Get current user

- **Analytics**:
  - `GET /api/dashboard/stats` — Meeting/action-item stats for charts

### AI Provider Architecture

**Provider abstraction**: All AI models use OpenAI-compatible APIs via the `openai` SDK. Provider configs in [server/api/summarize.post.ts](server/api/summarize.post.ts):

- **DeepSeek**: `baseURL: 'https://api.deepseek.com/v1'`, model: `deepseek-chat`
- **Qwen**: `baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'`, model: `qwen-plus`
- **Doubao**: `baseURL: 'https://ark.cn-beijing.volces.com/api/v3'`, model: user's `DOBAO_MODEL_ID` (endpoint ID from 火山引擎)

**Streaming**: All AI responses use SSE (Server-Sent Events). Frontend receives `{chunk: string}` events, then `{done: true, full: string}` when complete.

**Prompt versioning**: Prompts in `server/prompts/index.ts` export a `version` string. Every AI call logs the prompt version to `ai_logs` table for A/B testing and validation tracking.

**Validation**: AI responses parsed with Zod schemas (`shared/schemas/meeting.ts`). Validation results logged to `ai_logs.validationPassed` / `validationErrors`.

### Frontend Pages

- [app/pages/index.vue](app/pages/index.vue) — Main analysis UI (textarea/file upload, model selector, streaming results)
- [app/pages/dashboard.vue](app/pages/dashboard.vue) — Charts and stats (meetings over time, action items by priority)
- [app/pages/integrations.vue](app/pages/integrations.vue) — Notion/Jira/Linear config forms
- [app/pages/login.vue](app/pages/login.vue) — Login/register forms

### Notion Integration

**Flow**: User configures Notion integration token + database ID in [app/pages/integrations.vue](app/pages/integrations.vue) → saved to `integrations_config` table → when syncing action items, `POST /api/integrations/notion` creates pages in Notion database with structured properties (Title, Assignee, Due Date, Priority, Status).

**Sync tracking**: After successful sync, `action_items.externalService = 'notion'`, `externalServiceId = <page_id>`, `externalUrl = <notion_page_url>`. Frontend shows "已同步" badge and disables re-sync button.

**Notion API requirements**:
- Integration must have access to the target database (share database with integration in Notion UI)
- Database must have properties matching the action item schema (Title, Assignee, Due Date, Priority, Status)

## Environment Variables

**Required for production**:
- `TURSO_DB_URL` / `TURSO_AUTH_TOKEN` — Turso database credentials
- `NUXT_SESSION_PASSWORD` — Min 32 chars, for session encryption
- `NUXT_PUBLIC_SITE_URL` — Site URL (affects CORS, redirects)
- At least one AI model API key: `DEEPSEEK_API_KEY` / `QWEN_API_KEY` / `DOBAO_API_KEY` + `DOBAO_MODEL_ID`

**Optional**:
- `NOTION_INTEGRATION_TOKEN` / `NOTION_DATABASE_ID` — For Notion sync feature

**Development fallbacks**:
- Database: Falls back to `file:./data/minutai.db` when `TURSO_DB_URL` unset
- Session password: Uses `'dev-secret-must-be-32-characters-long'` (insecure, dev-only)

## Key Patterns

### Adding a New AI Model

1. Add API key to [nuxt.config.ts](nuxt.config.ts) `runtimeConfig`
2. Add provider case to `buildProviderConfig()` in [server/api/summarize.post.ts](server/api/summarize.post.ts) and [server/api/compare.post.ts](server/api/compare.post.ts)
3. Add provider option to `providers` array in [app/pages/index.vue](app/pages/index.vue)
4. Update TypeScript types (`TProvider` union)

### Database Migrations

After modifying [server/db/schema.ts](server/db/schema.ts):
1. Run `pnpm db:generate` to create migration SQL
2. Review generated file in `server/db/migrations/`
3. Run `pnpm db:migrate` to apply (or deploy — Vercel runs migrations via `build:vercel` script)

### Streaming AI Responses

All AI endpoints return SSE streams. Frontend pattern:
```typescript
const response = await fetch('/api/summarize', { method: 'POST', body: JSON.stringify({...}) })
const reader = response.body.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  
  const chunk = decoder.decode(value)
  const lines = chunk.split('\n\n')
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6))
      if (data.chunk) { /* append to UI */ }
      if (data.done) { /* finalize */ }
      if (data.error) { /* show error */ }
    }
  }
}
```

### Anonymous User Handling

- Backend: `userId: null` in database queries (meetings/action_items filtered by `userId IS NULL`)
- Frontend: Integration configs stored in `localStorage` when not logged in (key: `integrations_config`)
- Login migration: Anonymous data NOT automatically migrated to user account (by design — keeps anonymous sessions isolated)

## Deployment

**Vercel** (recommended):
- Build command: `pnpm build:vercel` (runs migrations before build)
- Environment variables: Set all required vars in Vercel dashboard
- Framework preset: Nuxt.js (auto-detected)

**Database**: Turso (remote SQLite). Create database at https://turso.tech, copy URL + auth token to env vars.

## Common Issues

**Doubao model fails with timeout**: Check `DOBAO_MODEL_ID` is correct endpoint ID (not model name). Timeout set to 30s to fail fast on wrong endpoint.

**Notion sync fails**: Verify integration has access to database (Notion UI → database → Share → add integration). Check database has required properties (Title, Assignee, Due Date, Priority, Status).

**Database migration fails on Vercel**: Ensure `TURSO_DB_URL` and `TURSO_AUTH_TOKEN` are set in Vercel environment variables before deploying.

**AI validation errors in logs**: Check `GET /api/dev/ai-logs` for recent failures. Update prompt or schema if models consistently fail validation.
