// ── AI / Summary types ────────────────────────────────────────────────────────

// export type TProvider = 'deepseek' | 'qwen' | 'doubao';
export type TProvider = 'deepseek' | 'qwen' | 'doubao'
export type TInputType = 'transcript' | 'free-notes'
export type TPriority = 'high' | 'medium' | 'low'

export interface IActionItem {
    task: string
    owner: string
    deadline: string
    priority: TPriority
}

export interface IDecision {
    decision: string
    rationale: string
    madeBy: string
}

export interface IMeetingSummary {
    summary: string
    actionItems: IActionItem[]
    decisions: IDecision[]
    participants: string[]
    meetingType: string
    keyTopics: string[]
}

// ── Compare ───────────────────────────────────────────────────────────────────

export interface ICompareResult {
    provider: TProvider
    result: IMeetingSummary | { error: string }
}

export interface ICompareResponse {
    a: ICompareResult
    b: ICompareResult
}

// ── History ───────────────────────────────────────────────────────────────────

export interface IHistoryEntry {
    id: string
    date: string // ISO string
    meetingType: string
    provider: TProvider
    charCount: number
    summary: IMeetingSummary | ICompareResponse
    transcript: string
    mode: 'single' | 'compare'
}

export interface IHistoryPage {
    data: IHistoryEntry[]
    total: number
    page: number
    limit: number
}

// ── Integration configs ───────────────────────────────────────────────────────

export interface INotionConfig {
    enabled: boolean
    integrationToken: string
    databaseId: string
}

export interface IIntegrationsConfig {
    notion: INotionConfig
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface IUser {
    id: string
    provider: string
    providerAccountId: string
    name: string | null
    email: string | null
    avatarUrl: string | null
    createdAt: string
}
