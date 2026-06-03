<script setup lang="ts">
import type { IHistoryEntry, ICompareResponse } from '~/types/index'
import type { Citation } from '~/composables/useRagAsk'

function isCompareEntry(entry: IHistoryEntry): entry is IHistoryEntry & { summary: ICompareResponse } {
    return entry.mode === 'compare'
}

const props = defineProps<{
    history: (IHistoryEntry & { indexStatus?: string | null })[]
    activeHistoryId: string | null
    historyTotal: number
    historyHasMore: boolean
    historyLoading: boolean
    providerName: (provider: IHistoryEntry['provider']) => string
    formatDate: (date: string, withTime?: boolean) => string
    ragStatus: Record<string, string>
}>()

const emit = defineEmits<{
    clear: []
    loadMore: []
    openEntry: [entry: IHistoryEntry]
    deleteEntry: [id: string]
    retryIndex: [meetingId: string]
}>()

const open = ref(false)
const activeTab = ref<'history' | 'ask'>('history')
const { loggedIn } = useAuth()

const { question, answer, citations, loading: askLoading, error: askError, scope, dateRange, ask, reset: resetAsk } = useRagAsk()

function closeSidebar() {
    open.value = false
}

function handleOpenEntry(entry: IHistoryEntry) {
    emit('openEntry', entry)
    closeSidebar()
}

function handleOpenCitation(citation: Citation) {
    const entry = props.history.find((e) => e.id === citation.meetingId)

    if (entry) {
        emit('openEntry', entry)
        closeSidebar()
    }
}

function getIndexStatus(entry: IHistoryEntry & { indexStatus?: string | null }): string | null {
    return props.ragStatus[entry.id] ?? entry.indexStatus ?? null
}

function handleAsk() {
    ask(props.activeHistoryId ?? undefined)
}
</script>

<template>
    <button type="button" class="history-btn" @click="open = true">
        <span class="history-btn-icon">◷</span>
        历史记录
        <span class="history-count" :class="{ empty: !props.historyTotal }">{{ props.historyTotal || 0 }}</span>
    </button>

    <Teleport to="body">
        <div class="sidebar-layer" :class="{ active: open }">
            <Transition name="fade">
                <div v-if="open" class="sidebar-backdrop" @click="closeSidebar" />
            </Transition>

            <Transition name="sidebar">
                <aside v-if="open" class="sidebar">
                    <div class="sidebar-header">
                        <div class="sidebar-tabs">
                            <button type="button" :class="['sidebar-tab', activeTab === 'history' ? 'active' : '']" @click="activeTab = 'history'">
                                历史记录
                            </button>
                            <button type="button" :class="['sidebar-tab', activeTab === 'ask' ? 'active' : '']" @click="activeTab = 'ask'">
                                问历史
                            </button>
                        </div>
                        <div class="sidebar-header-actions">
                            <button v-if="activeTab === 'history' && props.history.length" type="button" class="sidebar-clear" @click="emit('clear')">
                                清空全部
                            </button>
                            <button type="button" class="sidebar-close" @click="closeSidebar">✕</button>
                        </div>
                    </div>

                    <!-- History tab -->
                    <template v-if="activeTab === 'history'">
                        <div v-if="!props.history.length" class="sidebar-empty">暂无历史记录，先开始一段新的对话或摘要吧</div>

                        <ul v-else class="history-list">
                            <li
                                v-for="entry in props.history"
                                :key="entry.id"
                                :class="['history-item', props.activeHistoryId === entry.id ? 'active' : '']"
                                @click="handleOpenEntry(entry)"
                            >
                                <div class="history-item-main">
                                    <span class="history-meeting-type">{{ entry.meetingType }}</span>
                                    <div class="history-item-controls">
                                        <span v-if="getIndexStatus(entry) === 'succeeded'" class="index-badge succeeded" title="已索引">●</span>
                                        <span v-else-if="getIndexStatus(entry) === 'running'" class="index-badge running" title="索引中">●</span>
                                        <button
                                            v-else-if="getIndexStatus(entry) === 'failed'"
                                            type="button"
                                            class="index-badge failed"
                                            title="索引失败，点击重试"
                                            @click.stop="emit('retryIndex', entry.id)"
                                        >
                                            ↺
                                        </button>
                                        <span v-else-if="getIndexStatus(entry) === 'pending'" class="index-badge pending" title="等待索引">●</span>
                                        <button type="button" class="history-delete" @click.stop="emit('deleteEntry', entry.id)">✕</button>
                                    </div>
                                </div>
                                <div class="history-item-meta">
                                    <span class="history-date">{{ props.formatDate(entry.date, true) }}</span>
                                    <template v-if="isCompareEntry(entry)">
                                        <span class="history-provider compare-provider">
                                            ⇄ {{ props.providerName(entry.summary.a.provider) }} vs {{ props.providerName(entry.summary.b.provider) }}
                                        </span>
                                    </template>
                                    <template v-else>
                                        <span class="history-provider">{{ props.providerName(entry.provider) }}</span>
                                    </template>
                                </div>
                                <div class="history-item-stats">
                                    <template v-if="isCompareEntry(entry)">
                                        <span>对比模式</span>
                                        <span>{{ entry.charCount.toLocaleString() }} 字符</span>
                                    </template>
                                    <template v-else>
                                        <span>{{ (entry.summary as any)?.participants?.length ?? 0 }} 参与人</span>
                                        <span>{{ (entry.summary as any)?.actionItems?.length ?? 0 }} 行动项</span>
                                        <span>{{ entry.charCount.toLocaleString() }} 字符</span>
                                    </template>
                                </div>
                            </li>
                        </ul>

                        <div v-if="props.historyHasMore" class="sidebar-load-more">
                            <button type="button" class="load-more-btn" :disabled="props.historyLoading" @click="emit('loadMore')">
                                {{ props.historyLoading ? '加载中...' : '加载更多' }}
                            </button>
                        </div>
                    </template>

                    <!-- Ask tab -->
                    <template v-else>
                        <div v-if="!loggedIn" class="ask-login-hint">
                            <div class="ask-login-icon">🔒</div>
                            <div class="ask-login-title">登录后可使用历史问答</div>
                            <div class="ask-login-desc">历史问答基于向量检索，需要账号来隔离你的会议数据</div>
                            <a href="/login" class="ask-login-btn">去登录</a>
                        </div>
                        <div v-else class="ask-panel">
                            <div class="ask-controls">
                                <div class="ask-control-group">
                                    <label class="ask-label">范围</label>
                                    <div class="ask-radio-group">
                                        <label class="ask-radio">
                                            <input v-model="scope" type="radio" value="all" />
                                            全部会议
                                        </label>
                                        <label class="ask-radio">
                                            <input v-model="scope" type="radio" value="current" />
                                            当前会议
                                        </label>
                                    </div>
                                </div>
                                <div class="ask-control-group">
                                    <label class="ask-label">时间</label>
                                    <select v-model="dateRange" class="ask-select">
                                        <option value="all">全部</option>
                                        <option value="7d">最近 7 天</option>
                                        <option value="30d">最近 30 天</option>
                                    </select>
                                </div>
                            </div>

                            <div class="ask-input-row">
                                <textarea
                                    v-model="question"
                                    class="ask-input"
                                    placeholder="例如：谁负责登录页？上次讨论了哪些高优先级任务？"
                                    rows="3"
                                    @keydown.ctrl.enter.prevent="handleAsk"
                                />
                                <button type="button" class="ask-btn" :disabled="askLoading || !question.trim()" @click="handleAsk">
                                    {{ askLoading ? '...' : '提问' }}
                                </button>
                            </div>

                            <div v-if="askError" class="ask-error">{{ askError }}</div>

                            <div v-if="answer" class="ask-answer">
                                <div class="ask-answer-text">{{ answer }}</div>

                                <div v-if="citations.length" class="ask-citations">
                                    <div class="ask-citations-title">引用来源</div>
                                    <div
                                        v-for="(c, i) in citations"
                                        :key="i"
                                        class="ask-citation-item"
                                        @click="handleOpenCitation(c)"
                                    >
                                        <span class="citation-date">{{ c.date.slice(0, 10) }}</span>
                                        <span class="citation-type">{{ c.meetingType }}</span>
                                        <span class="citation-excerpt">{{ c.excerpt }}</span>
                                    </div>
                                </div>
                            </div>

                            <div v-else-if="!askLoading && !askError" class="ask-empty">
                                输入问题，从历史会议中检索答案
                            </div>
                        </div>
                    </template>
                </aside>
            </Transition>
        </div>
    </Teleport>
</template>

<style scoped>
.history-btn {
    appearance: none;
    -webkit-appearance: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 38px;
    padding: 0 14px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-sizing: border-box;
    color: var(--text-muted);
    font-family:
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        'Segoe UI',
        sans-serif;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
    text-decoration: none;
    line-height: 1.2;
    flex-shrink: 0;
}

.history-btn:hover {
    border-color: var(--accent);
    color: var(--text);
}

.history-btn-icon {
    font-size: 15px;
}

.history-count {
    background: var(--accent-soft);
    color: white;
    font-size: 10px;
    font-family: 'DM Mono', monospace;
    padding: 1px 6px;
    border-radius: 10px;
    min-width: 18px;
    text-align: center;
}

.history-count.empty {
    visibility: hidden;
}

.sidebar-layer {
    position: fixed;
    inset: 0;
    z-index: 199;
    overflow: clip;
    pointer-events: none;
}

.sidebar-layer.active {
    pointer-events: auto;
}

.sidebar {
    position: fixed;
    top: 0;
    right: 0;
    width: 340px;
    max-width: min(340px, 100vw);
    height: 100vh;
    background: var(--bg-card);
    border-left: 1px solid var(--border);
    z-index: 200;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    pointer-events: auto;
}

.sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px 0;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    gap: 8px;
}

.sidebar-tabs {
    display: flex;
    gap: 0;
    flex: 1;
}

.sidebar-tab {
    appearance: none;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 600;
    padding: 8px 12px;
    cursor: pointer;
    transition: all 0.15s;
    margin-bottom: -1px;
}

.sidebar-tab.active {
    color: var(--text);
    border-bottom-color: var(--accent);
}

.sidebar-tab:hover:not(.active) {
    color: var(--text);
}

.sidebar-header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
    padding-bottom: 8px;
}

.sidebar-clear {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: var(--text-muted);
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: color 0.2s;
}

.sidebar-clear:hover {
    color: var(--red);
}

.sidebar-close {
    appearance: none;
    -webkit-appearance: none;
    background: var(--bg-hover);
    border: 1px solid var(--border-bright);
    color: var(--text-muted);
    width: 28px;
    height: 28px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.sidebar-empty {
    padding: 40px 20px;
    text-align: center;
    font-size: 13px;
    color: var(--text-muted);
    line-height: 1.6;
}

.history-list {
    list-style: none;
    overflow-y: auto;
    flex: 1;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.history-item {
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--bg-card);
    cursor: pointer;
    transition: all 0.15s;
}

.history-item:hover {
    border-color: var(--border-bright);
    background: var(--bg-hover);
}

.history-item.active {
    border-color: var(--accent-soft);
    background: var(--accent-glow);
}

.history-item-main {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 6px;
}

.history-meeting-type {
    font-size: 13px;
    font-weight: 600;
    line-height: 1.3;
    flex: 1;
    margin-right: 8px;
}

.history-item-controls {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
}

.index-badge {
    font-size: 10px;
    line-height: 1;
    padding: 0;
    border: none;
    background: none;
    cursor: default;
}

.index-badge.succeeded {
    color: #22c55e;
}

.index-badge.running {
    color: #f59e0b;
    animation: pulse 1.2s ease-in-out infinite;
}

.index-badge.pending {
    color: var(--text-dim);
}

.index-badge.failed {
    color: var(--red, #ef4444);
    cursor: pointer;
    font-size: 13px;
    border-radius: 3px;
    padding: 1px 3px;
    transition: background 0.2s;
}

.index-badge.failed:hover {
    background: rgb(239 68 68 / 10%);
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
}

.history-delete {
    appearance: none;
    -webkit-appearance: none;
    background: none;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    font-size: 11px;
    padding: 2px 4px;
    border-radius: 3px;
    transition: color 0.2s;
}

.history-delete:hover {
    color: var(--red);
}

.history-item-meta {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 6px;
}

.history-date {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    color: var(--text-muted);
}

.history-provider {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    color: var(--accent);
    background: var(--accent-glow);
    padding: 1px 6px;
    border-radius: 10px;
}

.compare-provider {
    color: var(--blue);
    background: rgb(91 196 255 / 10%);
}

.history-item-stats {
    display: flex;
    gap: 8px;
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    color: var(--text-dim);
}

.sidebar-load-more {
    padding: 12px;
    border-top: 1px solid var(--border);
    background: var(--bg-card);
}

.load-more-btn {
    width: 100%;
}

.ask-login-hint {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    flex: 1;
    padding: 40px 24px;
    text-align: center;
}

.ask-login-icon {
    font-size: 32px;
    line-height: 1;
}

.ask-login-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
}

.ask-login-desc {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.6;
}

.ask-login-btn {
    margin-top: 6px;
    display: inline-block;
    padding: 7px 20px;
    background: var(--accent-soft);
    color: white;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    transition: opacity 0.2s;
}

.ask-login-btn:hover {
    opacity: 0.85;
}

/* Ask panel */
.ask-panel {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
    padding: 14px;
    gap: 12px;
    overflow-y: auto;
}

.ask-controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--bg-hover);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 12px;
}

.ask-control-group {
    display: flex;
    align-items: center;
    gap: 10px;
}

.ask-label {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    color: var(--text-muted);
    width: 28px;
    flex-shrink: 0;
}

.ask-radio-group {
    display: flex;
    gap: 12px;
}

.ask-radio {
    font-size: 12px;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
}

.ask-radio input[type='radio'] {
    accent-color: var(--accent);
}

.ask-select {
    font-size: 12px;
    color: var(--text);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 4px 8px;
    cursor: pointer;
    font-family: inherit;
    transition: border-color 0.2s;
}

.ask-select:focus {
    outline: none;
    border-color: var(--accent-soft);
}

.ask-input-row {
    display: flex;
    gap: 8px;
    align-items: flex-end;
}

.ask-input {
    flex: 1;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-size: 13px;
    padding: 8px 10px;
    resize: none;
    line-height: 1.5;
    font-family: inherit;
    transition: border-color 0.2s;
}

.ask-input:focus {
    outline: none;
    border-color: var(--accent-soft);
}

.ask-btn {
    appearance: none;
    height: 36px;
    padding: 0 16px;
    font-size: 13px;
    font-weight: 600;
    flex-shrink: 0;
    background: var(--accent-soft);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: opacity 0.2s;
    line-height: 1;
    font-family: inherit;
}

.ask-btn:hover:not(:disabled) {
    opacity: 0.85;
}

.ask-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.ask-error {
    font-size: 12px;
    color: var(--red, #ef4444);
    background: rgb(239 68 68 / 8%);
    border-radius: 6px;
    padding: 8px 10px;
}

.ask-empty {
    font-size: 12px;
    color: var(--text-dim);
    text-align: center;
    padding: 20px 0;
}

.ask-answer {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.ask-answer-text {
    font-size: 13px;
    line-height: 1.7;
    color: var(--text);
    white-space: pre-wrap;
    word-break: break-word;
}

.ask-citations {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.ask-citations-title {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.ask-citation-item {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg-hover);
    cursor: pointer;
    transition: border-color 0.15s;
}

.ask-citation-item:hover {
    border-color: var(--accent-soft);
}

.citation-date {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    color: var(--text-muted);
}

.citation-type {
    font-size: 11px;
    font-weight: 600;
    color: var(--accent);
}

.citation-excerpt {
    font-size: 11px;
    color: var(--text-muted);
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.sidebar-backdrop {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 50%);
    pointer-events: auto;
}

.sidebar-enter-active,
.sidebar-leave-active {
    transition: transform 0.3s ease;
}

.sidebar-enter-from,
.sidebar-leave-to {
    transform: translateX(100%);
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
