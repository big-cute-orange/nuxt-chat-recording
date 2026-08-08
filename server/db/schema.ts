import { sqliteTable, text, integer, unique, index } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// ── users ─────────────────────────────────────────────────────────────────────
// OAuth user profile. Created on first login, updated periodically.

export const users = sqliteTable(
    'users',
    {
        id: text('id').primaryKey(), // crypto.randomUUID()
        username: text('username').unique(), // local auth only
        passwordHash: text('password_hash'), // local auth only
        provider: text('provider').notNull(), // 'local'
        providerAccountId: text('provider_account_id').notNull(),
        name: text('name'),
        email: text('email'), // nullable — local users may not have email
        avatarUrl: text('avatar_url'),
        createdAt: text('created_at')
            .notNull()
            .default(sql`CURRENT_TIMESTAMP`), // ISO string
        updatedAt: text('updated_at')
            .notNull()
            .default(sql`CURRENT_TIMESTAMP`), // ISO string
    },
    (table) => ({
        usernameIdx: index('users_username_idx').on(table.username),
        providerIdx: index('users_provider_idx').on(table.provider),
    })
)

// ── meetings ──────────────────────────────────────────────────────────────────
// User meeting transcripts and summaries. userId is nullable for anonymous users.

export const meetings = sqliteTable(
    'meetings',
    {
        id: text('id').primaryKey(), // crypto.randomUUID()
        userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
        date: text('date').notNull(), // ISO string (meeting date as entered/inferred)
        meetingType: text('meeting_type').notNull().default('Meeting'),
        provider: text('provider').notNull(), // 'anthropic' | 'openai' | 'gemini'
        mode: text('mode').notNull().default('single'), // 'single' | 'compare'
        charCount: integer('char_count').notNull().default(0),
        transcript: text('transcript').notNull().default(''),
        summary: text('summary').notNull(), // JSON-serialised IMeetingSummary
        createdAt: text('created_at')
            .notNull()
            .default(sql`CURRENT_TIMESTAMP`), // ISO string
    },
    (table) => ({
        userIdIdx: index('meetings_user_id_idx').on(table.userId),
        dateIdx: index('meetings_date_idx').on(table.date),
    })
)

// ── integrations_config ───────────────────────────────────────────────────────
// Per-user integration credentials. One row per (userId, service) pair.
// userId is nullable for anonymous localStorage-backed configs.

export const integrationsConfig = sqliteTable(
    'integrations_config',
    {
        id: text('id').primaryKey(), // crypto.randomUUID()
        userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
        service: text('service').notNull(), // 'jira' | 'linear' | 'notion' | 'azure'
        config: text('config').notNull(), // JSON-serialised service-specific config
        updatedAt: text('updated_at')
            .notNull()
            .default(sql`CURRENT_TIMESTAMP`), // ISO string
    },
    (table) => ({
        userServiceUq: unique('integrations_config_user_service_uq').on(table.userId, table.service),
        userIdIdx: index('integrations_config_user_id_idx').on(table.userId),
        serviceIdx: index('integrations_config_service_idx').on(table.service),
    })
)

// ── action_items ──────────────────────────────────────────────────────────────
// Action items extracted from meetings and synced to external services.

export const actionItems = sqliteTable(
    'action_items',
    {
        id: text('id').primaryKey(), // crypto.randomUUID()
        meetingId: text('meeting_id')
            .notNull()
            .references(() => meetings.id, { onDelete: 'cascade' }),
        userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
        title: text('title').notNull(),
        description: text('description'),
        assignee: text('assignee'),
        dueDate: text('due_date'),
        priority: text('priority').notNull().default('MEDIUM'), // 'LOW' | 'MEDIUM' | 'HIGH'
        status: text('status').notNull().default('TODO'), // 'TODO' | 'IN_PROGRESS' | 'DONE'
        // External service reference
        externalService: text('external_service'), // 'jira' | 'linear' | 'notion' | 'azure'
        externalServiceId: text('external_service_id'), // Issue ID in external system
        externalUrl: text('external_url'), // Link to ticket
        createdAt: text('created_at')
            .notNull()
            .default(sql`CURRENT_TIMESTAMP`),
        updatedAt: text('updated_at')
            .notNull()
            .default(sql`CURRENT_TIMESTAMP`),
    },
    (table) => ({
        meetingIdIdx: index('action_items_meeting_id_idx').on(table.meetingId),
        userIdIdx: index('action_items_user_id_idx').on(table.userId),
        externalServiceIdx: index('action_items_external_service_idx').on(table.externalService),
    })
)

// ── ai_logs ───────────────────────────────────────────────────────────────────
// Records every AI call for prompt version tracking and validation analysis.

export const aiLogs = sqliteTable(
    'ai_logs',
    {
        id: text('id').primaryKey(),
        meetingId: text('meeting_id').references(() => meetings.id, { onDelete: 'cascade' }),
        provider: text('provider').notNull(),
        promptVersion: text('prompt_version').notNull(),
        rawOutput: text('raw_output').notNull(),
        validationPassed: integer('validation_passed', { mode: 'boolean' }).notNull(),
        validationErrors: text('validation_errors'),
        createdAt: text('created_at')
            .notNull()
            .default(sql`CURRENT_TIMESTAMP`),
    },
    (table) => ({
        providerIdx: index('ai_logs_provider_idx').on(table.provider),
        promptVersionIdx: index('ai_logs_prompt_version_idx').on(table.promptVersion),
        createdAtIdx: index('ai_logs_created_at_idx').on(table.createdAt),
    })
)

// ── judge_results ─────────────────────────────────────────────────────────────
// Stores LLM-as-judge evaluation results for compare-mode runs.

export const judgeResults = sqliteTable(
    'judge_results',
    {
        id: text('id').primaryKey(),
        providerA: text('provider_a').notNull(),
        providerB: text('provider_b').notNull(),
        judgeProvider: text('judge_provider').notNull(),
        winner: text('winner').notNull(), // 'model_a' | 'model_b' | 'tie'
        scoresA: text('scores_a').notNull(), // JSON: { completeness, accuracy, actionability, conciseness, overall }
        scoresB: text('scores_b').notNull(),
        reason: text('reason').notNull(),
        createdAt: text('created_at')
            .notNull()
            .default(sql`CURRENT_TIMESTAMP`),
    },
    (table) => ({
        providerAIdx: index('judge_results_provider_a_idx').on(table.providerA),
        providerBIdx: index('judge_results_provider_b_idx').on(table.providerB),
        judgeProviderIdx: index('judge_results_judge_provider_idx').on(table.judgeProvider),
        createdAtIdx: index('judge_results_created_at_idx').on(table.createdAt),
    })
)

// ── rag_index_jobs ────────────────────────────────────────────────────────────
// Tracks vector indexing status per meeting for the RAG Q&A feature.

export const ragIndexJobs = sqliteTable(
    'rag_index_jobs',
    {
        id: text('id').primaryKey(),
        meetingId: text('meeting_id')
            .notNull()
            .unique()
            .references(() => meetings.id, { onDelete: 'cascade' }),
        userId: text('user_id'),
        status: text('status').notNull().default('pending'), // 'pending' | 'running' | 'succeeded' | 'failed'
        chunkCount: integer('chunk_count'),
        chunkIds: text('chunk_ids'), // JSON array of Upstash vector IDs for this meeting
        error: text('error'),
        createdAt: text('created_at')
            .notNull()
            .default(sql`CURRENT_TIMESTAMP`),
        updatedAt: text('updated_at')
            .notNull()
            .default(sql`CURRENT_TIMESTAMP`),
    },
    (table) => ({
        meetingIdIdx: index('rag_index_jobs_meeting_id_idx').on(table.meetingId),
        userIdIdx: index('rag_index_jobs_user_id_idx').on(table.userId),
        statusIdx: index('rag_index_jobs_status_idx').on(table.status),
    })
)

// ── Export types for use in server and client code ──────────────────────────────
export type IUser = typeof users.$inferSelect
export type IMeeting = typeof meetings.$inferSelect
export type IIntegrationConfig = typeof integrationsConfig.$inferSelect
export type IActionItem = typeof actionItems.$inferSelect
export type IAiLog = typeof aiLogs.$inferSelect
export type IJudgeResult = typeof judgeResults.$inferSelect
export type IRagIndexJob = typeof ragIndexJobs.$inferSelect
