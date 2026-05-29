<script setup lang="ts">
import type { IMeetingSummary, TPriority } from '~/types/index'
import type { TIntegrationId, ISendStatus } from '~/composables/useIntegrations'

const props = defineProps<{
    result: IMeetingSummary
    submittedText: string
    providerLabel: string
    priorityConfig: Record<TPriority, { label: string; color: string; bg: string }>
    activeHistoryId: string | null
    hasIntegrations: boolean
    enabledIntegrations: TIntegrationId[]
    integrationMeta: Record<TIntegrationId, { label: string; logo: string; logoClass: string }>
    intStatus: Record<TIntegrationId, ISendStatus>
    sendTo: (id: TIntegrationId, result: IMeetingSummary, meetingId: string | null) => void
}>()

const emit = defineEmits<{
    reset: []
    'save-edit': [IMeetingSummary]
}>()

// ── Edit mode ─────────────────────────────────────────────────────────────────
const editing = ref(false)
const draft = ref<IMeetingSummary | null>(null)

function startEditing() {
    draft.value = JSON.parse(JSON.stringify(props.result))
    editing.value = true
}

function cancelEditing() {
    draft.value = null
    editing.value = false
}

function saveEdits() {
    if (!draft.value) {
        return
    }

    emit('save-edit', { ...draft.value })
    editing.value = false
    draft.value = null
}

function addActionItem() {
    if (!draft.value) {
        return
    }

    draft.value.actionItems.push({ task: '', owner: '', deadline: '', priority: 'medium' })
}

function removeActionItem(i: number) {
    if (!draft.value) {
        return
    }

    draft.value.actionItems.splice(i, 1)
}

function addDecision() {
    if (!draft.value) {
        return
    }

    draft.value.decisions.push({ decision: '', rationale: '', madeBy: '' })
}

function removeDecision(i: number) {
    if (!draft.value) {
        return
    }

    draft.value.decisions.splice(i, 1)
}

function addParticipant() {
    if (!draft.value) {
        return
    }

    draft.value.participants.push('')
}

function removeParticipant(i: number) {
    if (!draft.value) {
        return
    }

    draft.value.participants.splice(i, 1)
}

function addTopic() {
    if (!draft.value) {
        return
    }

    draft.value.keyTopics.push('')
}

function removeTopic(i: number) {
    if (!draft.value) {
        return
    }

    draft.value.keyTopics.splice(i, 1)
}

// ── Export ────────────────────────────────────────────────────────────────────
const copiedKey = ref<string | null>(null)
const transcriptExpanded = ref(false)

function flashCopied(key: string) {
    copiedKey.value = key

    setTimeout(() => {
        copiedKey.value = null
    }, 2000)
}

function buildMarkdown(s: IMeetingSummary, prov?: string): string {
    const date = new Date().toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    })
    const via = prov ?? props.providerLabel
    const lines: string[] = []

    lines.push(`# 会议纪要 — ${s.meetingType}`)
    lines.push(`*${date} · 分析模型：${via}*`)
    lines.push('')
    lines.push('## 参与人')
    lines.push(s.participants.map((p: string) => `- ${p}`).join('\n'))
    lines.push('')
    lines.push('## 关键议题')
    lines.push(s.keyTopics.map((t: string) => `- ${t}`).join('\n'))
    lines.push('')
    lines.push('## 会议摘要')
    lines.push(s.summary)
    lines.push('')
    lines.push('## 行动项')

    s.actionItems.forEach((item: { priority: string; task: string; owner: string; deadline: string }) => {
        lines.push(`- **[${item.priority.toUpperCase()}]** ${item.task}`)
        lines.push(`  - 负责人：${item.owner}`)
        lines.push(`  - 截止日期：${item.deadline}`)
    })

    lines.push('')
    lines.push('## 决策事项')

    s.decisions.forEach((d: { decision: string; rationale: string; madeBy: string }, i: number) => {
        lines.push(`${i + 1}. **${d.decision}**`)
        if (d.rationale) lines.push(`   *${d.rationale}*`)
        lines.push(`   — ${d.madeBy}`)
    })

    return lines.join('\n')
}

function buildEmail(s: IMeetingSummary): string {
    const lines: string[] = []

    lines.push('大家好，', '')
    lines.push(`以下是本次 ${s.meetingType} 的会议摘要及后续行动项，供大家参考。`, '')
    lines.push('执行摘要', '--------', s.summary, '')

    if (s.actionItems.length) {
        lines.push('行动项', '------')

        s.actionItems.forEach((item: { task: string; owner: string; deadline: string; priority: string }) => {
            lines.push(`• ${item.task}`)
            lines.push(`  负责人：${item.owner} | 截止日期：${item.deadline}`)
        })

        lines.push('')
    }

    if (s.decisions.length) {
        lines.push('决策事项', '--------')

        s.decisions.forEach((d: { decision: string; rationale: string; madeBy: string }) => lines.push(`• ${d.decision}`))

        lines.push('')
    }

    lines.push('如有遗漏或需要更正，请随时告知。', '', '谢谢')

    return lines.join('\n')
}

async function copyToClipboard(text: string, key: string) {
    try {
        await navigator.clipboard.writeText(text)
    } catch {
        const el = document.createElement('textarea')

        el.value = text
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
    }

    flashCopied(key)
}

function downloadMarkdown(s: IMeetingSummary, prov?: string) {
    const content = buildMarkdown(s, prov)
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')

    a.href = url
    a.download = `${s.meetingType.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
    flashCopied('download')
}
</script>

<template>
    <Transition name="fade-up" appear>
        <section class="results-section">
            <!-- Results header -->
            <div class="results-header">
                <div class="results-meta">
                    <template v-if="!editing">
                        <span class="meeting-type-badge">{{ result.meetingType }}</span>
                        <span class="provider-badge">通过 {{ providerLabel }}</span>
                    </template>
                    <template v-else-if="draft">
                        <input v-model="draft.meetingType" class="edit-meeting-type" placeholder="会议类型" />
                        <span class="editing-indicator">✎ 编辑</span>
                    </template>
                </div>
                <div class="results-actions">
                    <template v-if="!editing">
                        <button class="edit-btn" title="Edit results" @click="startEditing">✎ 编辑</button>
                        <button class="reset-btn" @click="$emit('reset')">← 新建会议</button>
                    </template>
                    <template v-else>
                        <button class="cancel-btn" @click="cancelEditing">取消</button>
                        <button class="save-btn" @click="saveEdits">✓ 保存更改</button>
                    </template>
                </div>
            </div>

            <!-- Participants & Topics -->
            <div class="chips-row">
                <!-- View mode -->
                <template v-if="!editing">
                    <div class="chips-group">
                        <span class="chips-label">参会人员</span>
                        <span v-for="p in result.participants" :key="p" class="chip chip-blue">{{ p }}</span>
                    </div>
                    <div class="chips-group">
                        <span class="chips-label">讨论主题</span>
                        <span v-for="t in result.keyTopics" :key="t" class="chip chip-purple">{{ t }}</span>
                    </div>
                </template>
                <!-- Edit mode -->
                <template v-else-if="draft">
                    <div class="edit-chip-group">
                        <span class="chips-label">参会人员</span>
                        <div class="edit-chips">
                            <div v-for="(p, i) in draft.participants" :key="i" class="edit-chip-row">
                                <input v-model="draft.participants[i]" class="edit-chip-input chip-blue-input" placeholder="Name" />
                                <button class="remove-chip-btn" @click="removeParticipant(i)">✕</button>
                            </div>
                            <button class="add-chip-btn" @click="addParticipant">+ 添加人员</button>
                        </div>
                    </div>
                    <div class="edit-chip-group">
                        <span class="chips-label">讨论主题</span>
                        <div class="edit-chips">
                            <div v-for="(t, i) in draft.keyTopics" :key="i" class="edit-chip-row">
                                <input v-model="draft.keyTopics[i]" class="edit-chip-input chip-purple-input" placeholder="Topic" />
                                <button class="remove-chip-btn" @click="removeTopic(i)">✕</button>
                            </div>
                            <button class="add-chip-btn" @click="addTopic">+ 添加主题</button>
                        </div>
                    </div>
                </template>
            </div>

            <!-- Executive Summary -->
            <div class="card">
                <div class="card-header">
                    <span class="card-icon">◎</span>
                    <h2 class="card-title">执行摘要</h2>
                </div>
                <p v-if="!editing" class="summary-text">{{ result.summary }}</p>
                <textarea v-else-if="draft" v-model="draft.summary" class="edit-summary" rows="6" placeholder="Executive summary..." />
            </div>

            <!-- Action Items -->
            <div class="card">
                <div class="card-header">
                    <span class="card-icon">◉</span>
                    <h2 class="card-title">行动项</h2>
                    <span class="card-count">{{ editing ? draft?.actionItems.length : result.actionItems.length }}</span>
                </div>
                <!-- View mode -->
                <div v-if="!editing" class="action-items">
                    <div v-for="(item, i) in result.actionItems" :key="i" class="action-item">
                        <div class="action-left">
                            <span
                                class="priority-badge"
                                :style="{
                                    color: priorityConfig[item.priority]?.color ?? 'var(--text)',
                                    background: priorityConfig[item.priority]?.bg ?? 'rgba(0,0,0,0.05)',
                                }"
                            >
                                {{ priorityConfig[item.priority]?.label ?? item.priority }}
                            </span>
                            <span class="action-task">{{ item.task }}</span>
                        </div>
                        <div class="action-right">
                            <span class="action-meta">👤 {{ item.owner }}</span>
                            <span class="action-meta">📅 {{ item.deadline }}</span>
                        </div>
                    </div>
                </div>
                <!-- Edit mode -->
                <div v-else-if="draft" class="edit-action-items">
                    <div v-for="(item, i) in draft.actionItems" :key="i" class="edit-action-item">
                        <div class="edit-action-main">
                            <select
                                v-model="item.priority"
                                class="edit-priority-select"
                                :style="{ color: priorityConfig[item.priority]?.color ?? 'var(--text)' }"
                            >
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                            </select>
                            <input v-model="item.task" class="edit-input edit-task" placeholder="Task description" />
                            <button class="remove-item-btn" title="Remove" @click="removeActionItem(i)">✕</button>
                        </div>
                        <div class="edit-action-meta">
                            <span class="edit-meta-label">👤</span>
                            <input v-model="item.owner" class="edit-input edit-meta-input" placeholder="Owner" />
                            <span class="edit-meta-label">📅</span>
                            <input v-model="item.deadline" class="edit-input edit-meta-input" placeholder="Deadline" />
                        </div>
                    </div>
                    <button class="add-item-btn" @click="addActionItem">+ 添加行动项</button>
                </div>
            </div>

            <!-- Decisions -->
            <div class="card">
                <div class="card-header">
                    <span class="card-icon">◈</span>
                    <h2 class="card-title">决策事项</h2>
                    <span class="card-count">{{ editing ? draft?.decisions.length : result.decisions.length }}</span>
                </div>
                <!-- View mode -->
                <div v-if="!editing" class="decisions">
                    <div v-for="(d, i) in result.decisions" :key="i" class="decision-item">
                        <div class="decision-number">{{ String(i + 1).padStart(2, '0') }}</div>
                        <div class="decision-content">
                            <p class="decision-text">{{ d.decision }}</p>
                            <p v-if="d.rationale" class="decision-rationale">{{ d.rationale }}</p>
                            <span class="decision-by">— {{ d.madeBy }}</span>
                        </div>
                    </div>
                </div>
                <!-- Edit mode -->
                <div v-else-if="draft" class="edit-decisions">
                    <div v-for="(d, i) in draft.decisions" :key="i" class="edit-decision-item">
                        <div class="edit-decision-header">
                            <span class="decision-number">{{ String(i + 1).padStart(2, '0') }}</span>
                            <button class="remove-item-btn" title="Remove" @click="removeDecision(i)">✕</button>
                        </div>
                        <input v-model="d.decision" class="edit-input" placeholder="Decision" />
                        <input v-model="d.rationale" class="edit-input" placeholder="Rationale (optional)" />
                        <input v-model="d.madeBy" class="edit-input edit-small" placeholder="Made by" />
                    </div>
                    <button class="add-item-btn" @click="addDecision">+ 添加决策</button>
                </div>
            </div>

            <!-- Export -->
            <div v-if="!editing" class="card">
                <div class="card-header">
                    <span class="card-icon">↗</span>
                    <h2 class="card-title">导出</h2>
                </div>
                <div class="export-actions">
                    <button class="export-btn" @click="copyToClipboard(buildMarkdown(result), 'markdown')">
                        <span class="export-btn-icon">◻</span>
                        <span class="export-btn-label">复制为 Markdown</span>
                        <span class="export-btn-confirm" :class="{ visible: copiedKey === 'markdown' }">✓ 已复制!</span>
                    </button>
                    <button class="export-btn" @click="downloadMarkdown(result)">
                        <span class="export-btn-icon">↓</span>
                        <span class="export-btn-label">下载 .md 文件</span>
                        <span class="export-btn-confirm" :class="{ visible: copiedKey === 'download' }">✓ 完成!</span>
                    </button>
                    <button class="export-btn" @click="copyToClipboard(buildEmail(result), 'email')">
                        <span class="export-btn-icon">✉</span>
                        <span class="export-btn-label">复制跟进邮件</span>
                        <span class="export-btn-confirm" :class="{ visible: copiedKey === 'email' }">✓ 已复制!</span>
                    </button>
                </div>
            </div>

            <!-- Send to integrations -->
            <div v-if="!editing && hasIntegrations" class="card">
                <div class="card-header">
                    <span class="card-icon">⇄</span>
                    <h2 class="card-title">同步到…</h2>
                </div>
                <div class="integrations-grid">
                    <div v-for="id in enabledIntegrations" :key="id" class="integration-panel">
                        <div class="integration-panel-header">
                            <span class="int-logo-sm" :class="integrationMeta[id].logoClass">
                                {{ integrationMeta[id].logo }}
                            </span>
                            <span class="int-panel-name">{{ integrationMeta[id].label }}</span>
                            <button class="send-btn" :disabled="intStatus[id].loading" @click="sendTo(id, result, activeHistoryId)">
                                <span v-if="intStatus[id].loading" class="spinner" />
                                <span v-else-if="intStatus[id].results.length">✓ 已同步</span>
                                <span v-else>同步 {{ result.actionItems.length }} 项</span>
                            </button>
                        </div>

                        <!-- Error -->
                        <div v-if="intStatus[id].error" class="int-error">⚠ {{ intStatus[id].error }}</div>

                        <!-- Results -->
                        <div v-if="intStatus[id].results.length" class="int-results">
                            <div v-for="r in intStatus[id].results" :key="r.task" class="int-result-row">
                                <span v-if="r.error" class="int-result-error">✕ {{ r.task }} — {{ r.error }}</span>
                                <a v-else :href="r.url ?? '#'" target="_blank" class="int-result-ok">✓ {{ r.task }} ↗</a>
                            </div>
                        </div>
                    </div>
                </div>

                <div v-if="!hasIntegrations" class="int-empty">
                    未配置集成
                    <NuxtLink to="/integrations" class="int-setup-link">设置集成 →</NuxtLink>
                </div>
            </div>

            <!-- Original transcript -->
            <div class="card">
                <button class="transcript-toggle" @click="transcriptExpanded = !transcriptExpanded">
                    <div class="card-header" style="margin-bottom: 0">
                        <span class="card-icon">≡</span>
                        <h2 class="card-title">会议纪要原文</h2>
                        <span class="card-count">{{ submittedText.length.toLocaleString() }} 字符数</span>
                        <span class="expand-arrow" :class="{ rotated: transcriptExpanded }">▾</span>
                    </div>
                </button>
                <Transition name="expand">
                    <div v-if="transcriptExpanded" class="transcript-body">
                        <pre class="transcript-text">{{ submittedText }}</pre>
                    </div>
                </Transition>
            </div>
        </section>
    </Transition>
</template>

<style scoped>
/* ── Calendar links ──────────────────────────────────────────── */
.cal-links {
    display: flex;
    gap: 4px;
    margin-top: 4px;
}

.cal-btn {
    width: 22px;
    height: 22px;
    border-radius: 5px;
    font-size: 10px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    transition: all 0.15s;
    flex-shrink: 0;
}

.cal-btn.gcal {
    background: rgb(66 133 244 / 12%);
    color: #4285f4;
    border: 1px solid rgb(66 133 244 / 25%);
}

.cal-btn.gcal:hover {
    background: #4285f4;
    color: white;
}

.cal-btn.outlook {
    background: rgb(0 120 212 / 12%);
    color: #0078d4;
    border: 1px solid rgb(0 120 212 / 25%);
}

.cal-btn.outlook:hover {
    background: #0078d4;
    color: white;
}

.cal-export-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    padding: 12px 16px;
    background: var(--bg);
    border: 1px dashed var(--border-bright);
    border-radius: 10px;
    margin-top: 4px;
}

.cal-export-label {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: var(--text-muted);
    flex: 1;
}

.cal-export-btn {
    font-family: Syne, sans-serif;
    font-size: 12px;
    font-weight: 700;
    padding: 6px 14px;
    border-radius: 7px;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
}

.gcal-btn {
    background: rgb(66 133 244 / 12%);
    color: #4285f4;
    border: 1px solid rgb(66 133 244 / 25%);
}

.gcal-btn:hover {
    background: #4285f4;
    color: white;
}

.outlook-btn {
    background: rgb(0 120 212 / 12%);
    color: #0078d4;
    border: 1px solid rgb(0 120 212 / 25%);
}

.outlook-btn:hover {
    background: #0078d4;
    color: white;
}

/* ── Integrations card ───────────────────────────────────────── */
.integrations-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.integration-panel {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
}

.integration-panel-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
}

.int-logo-sm {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 11px;
    flex-shrink: 0;
}

.notion-logo {
    background: rgb(255 255 255 / 8%);
    color: var(--text);
    border: 1px solid var(--border-bright);
}

.int-panel-name {
    font-size: 13px;
    font-weight: 600;
    flex: 1;
}

.send-btn {
    background: var(--accent-glow);
    border: 1px solid var(--accent-soft);
    color: var(--accent);
    padding: 6px 14px;
    border-radius: 7px;
    font-family: Syne, sans-serif;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
}

.send-btn:hover:not(:disabled) {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
}

.send-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.int-error {
    padding: 8px 14px;
    font-size: 12px;
    color: var(--red);
    background: rgb(255 107 107 / 6%);
    border-top: 1px solid rgb(255 107 107 / 15%);
}

.int-results {
    padding: 8px 14px 12px;
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.int-result-row {
    font-size: 12px;
}

.int-result-ok {
    color: var(--green);
    text-decoration: none;
    font-family: 'DM Mono', monospace;
    font-size: 11px;
}

.int-result-ok:hover {
    text-decoration: underline;
}

.int-result-error {
    color: var(--red);
    font-family: 'DM Mono', monospace;
    font-size: 11px;
}

.int-empty {
    font-size: 13px;
    color: var(--text-muted);
    text-align: center;
    padding: 20px;
}

.int-setup-link {
    color: var(--accent);
    text-decoration: none;
    margin-left: 6px;
}

.int-setup-link:hover {
    text-decoration: underline;
}

/* ── Edit mode ───────────────────────────────────────────────── */
.results-actions {
    display: flex;
    gap: 8px;
    align-items: center;
}

.edit-btn {
    background: transparent;
    border: 1px solid var(--border-bright);
    color: var(--text-muted);
    padding: 8px 14px;
    border-radius: 8px;
    cursor: pointer;
    font-family: Syne, sans-serif;
    font-size: 12px;
    font-weight: 600;
    transition: all 0.2s;
}

.edit-btn:hover {
    color: var(--accent);
    border-color: var(--accent);
}

.save-btn {
    background: var(--accent);
    border: none;
    color: white;
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    font-family: Syne, sans-serif;
    font-size: 12px;
    font-weight: 700;
    transition: all 0.2s;
}

.save-btn:hover {
    background: var(--accent-soft);
}

.cancel-btn {
    background: transparent;
    border: 1px solid var(--border-bright);
    color: var(--text-muted);
    padding: 8px 14px;
    border-radius: 8px;
    cursor: pointer;
    font-family: Syne, sans-serif;
    font-size: 12px;
    font-weight: 600;
    transition: all 0.2s;
}

.cancel-btn:hover {
    color: var(--text);
}

.editing-indicator {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: var(--accent);
    background: var(--accent-glow);
    border: 1px solid var(--accent-soft);
    padding: 3px 10px;
    border-radius: 20px;
}

.edit-meeting-type {
    background: var(--bg);
    border: 1px solid var(--accent-soft);
    border-radius: 8px;
    color: var(--accent);
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    padding: 4px 12px;
    outline: none;
    min-width: 180px;
}

.edit-meeting-type:focus {
    border-color: var(--accent);
}

.edit-input {
    width: 100%;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-family: 'DM Mono', monospace;
    font-size: 12px;
    padding: 8px 12px;
    outline: none;
    transition: border-color 0.2s;
}

.edit-input:focus {
    border-color: var(--accent);
}

.edit-input::placeholder {
    color: var(--text-dim);
}

.edit-small {
    max-width: 240px;
}

.edit-summary {
    width: 100%;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-family: 'DM Mono', monospace;
    font-size: 12px;
    line-height: 1.7;
    padding: 12px;
    outline: none;
    resize: vertical;
    transition: border-color 0.2s;
}

.edit-summary:focus {
    border-color: var(--accent);
}

.edit-chip-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.edit-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
}

.edit-chip-row {
    display: flex;
    align-items: center;
    gap: 4px;
}

.edit-chip-input {
    background: var(--bg-card);
    border-radius: 20px;
    border: 1px solid var(--border);
    font-size: 12px;
    font-weight: 600;
    padding: 4px 10px;
    outline: none;
    color: var(--text);
    width: 120px;
    transition: border-color 0.2s;
}

.chip-blue-input {
    color: var(--blue);
    border-color: rgb(91 196 255 / 25%);
}

.chip-blue-input:focus {
    border-color: var(--blue);
}

.chip-purple-input {
    color: var(--accent);
    border-color: rgb(124 109 255 / 25%);
}

.chip-purple-input:focus {
    border-color: var(--accent);
}

.remove-chip-btn {
    background: none;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    font-size: 10px;
    padding: 2px 4px;
    border-radius: 3px;
    transition: color 0.2s;
}

.remove-chip-btn:hover {
    color: var(--red);
}

.add-chip-btn {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: var(--text-muted);
    background: none;
    border: 1px dashed var(--border-bright);
    border-radius: 20px;
    padding: 3px 10px;
    cursor: pointer;
    transition: all 0.2s;
}

.add-chip-btn:hover {
    color: var(--accent);
    border-color: var(--accent);
}

.edit-action-items {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.edit-action-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 16px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
}

.edit-action-main {
    display: flex;
    align-items: center;
    gap: 8px;
}

.edit-priority-select {
    background: var(--bg-card);
    border: 1px solid var(--border-bright);
    border-radius: 20px;
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    font-weight: 600;
    padding: 3px 8px;
    cursor: pointer;
    outline: none;
    flex-shrink: 0;
}

.edit-task {
    flex: 1;
}

.edit-action-meta {
    display: flex;
    align-items: center;
    gap: 8px;
}

.edit-meta-label {
    font-size: 14px;
    flex-shrink: 0;
}

.edit-meta-input {
    flex: 1;
}

.remove-item-btn {
    background: none;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    font-size: 12px;
    padding: 4px 6px;
    border-radius: 4px;
    transition: color 0.2s;
    flex-shrink: 0;
}

.remove-item-btn:hover {
    color: var(--red);
}

.add-item-btn {
    font-family: 'DM Mono', monospace;
    font-size: 12px;
    color: var(--text-muted);
    background: none;
    border: 1px dashed var(--border-bright);
    border-radius: 8px;
    padding: 10px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: center;
    width: 100%;
}

.add-item-btn:hover {
    color: var(--accent);
    border-color: var(--accent);
    background: var(--accent-glow);
}

.edit-decisions {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.edit-decision-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 16px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
}

.edit-decision-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

/* ── Single results ──────────────────────────────────────────── */
.results-section {
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-width: 860px;
}

.results-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
}

.results-meta {
    display: flex;
    gap: 10px;
    align-items: center;
}

.meeting-type-badge {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    background: var(--accent-glow);
    border: 1px solid var(--accent-soft);
    color: var(--accent);
    padding: 4px 12px;
    border-radius: 20px;
    letter-spacing: 0.05em;
}

.provider-badge {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: var(--text-muted);
}

.reset-btn {
    background: transparent;
    border: 1px solid var(--border-bright);
    color: var(--text-muted);
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    font-family: Syne, sans-serif;
    font-size: 12px;
    font-weight: 600;
    transition: all 0.2s;
}

.reset-btn:hover {
    color: var(--text);
    border-color: var(--accent);
}

.chips-row {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
}

.chips-group {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
}

.chips-label {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-right: 4px;
}

.chip {
    font-size: 12px;
    font-weight: 600;
    padding: 4px 12px;
    border-radius: 20px;
}

.chip-blue {
    background: rgb(91 196 255 / 10%);
    color: var(--blue);
    border: 1px solid rgb(91 196 255 / 20%);
}

.chip-purple {
    background: var(--accent-glow);
    color: var(--accent);
    border: 1px solid rgb(124 109 255 / 20%);
}

.card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 24px;
}

.card-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
}

.card-icon {
    font-size: 16px;
    color: var(--accent);
}

.card-title {
    font-size: 16px;
    font-weight: 700;
    flex: 1;
    letter-spacing: -0.3px;
}

.card-count {
    font-family: 'DM Mono', monospace;
    font-size: 12px;
    color: var(--text-muted);
    background: var(--bg-hover);
    border: 1px solid var(--border-bright);
    padding: 2px 9px;
    border-radius: 20px;
}

.summary-text {
    font-size: 14px;
    line-height: 1.8;
    color: var(--text);
    white-space: pre-wrap;
}

.action-items {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.action-item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 16px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    transition: border-color 0.2s;
}

.action-item:hover {
    border-color: var(--border-bright);
}

.action-left {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    flex: 1;
}

.priority-badge {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    font-weight: 500;
    padding: 3px 9px;
    border-radius: 20px;
    white-space: nowrap;
    letter-spacing: 0.05em;
    flex-shrink: 0;
}

.action-task {
    font-size: 13px;
    line-height: 1.5;
}

.action-right {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex-shrink: 0;
    text-align: right;
}

.action-meta {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
}

.decisions {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.decision-item {
    display: flex;
    gap: 20px;
    padding: 16px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
}

.decision-number {
    font-family: 'DM Mono', monospace;
    font-size: 18px;
    font-weight: 300;
    color: var(--text-dim);
    flex-shrink: 0;
    line-height: 1;
    padding-top: 2px;
}

.decision-text {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 6px;
    line-height: 1.4;
}

.decision-rationale {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.6;
    margin-bottom: 6px;
}

.decision-by {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: var(--accent);
}

/* Export */
.export-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.export-btn {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 13px 16px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    width: 100%;
    color: var(--text);
}

.export-btn:hover {
    border-color: var(--accent);
    background: var(--accent-glow);
}

.export-btn-icon {
    font-size: 16px;
    color: var(--accent);
    flex-shrink: 0;
    width: 20px;
    text-align: center;
}

.export-btn-label {
    font-family: Syne, sans-serif;
    font-size: 13px;
    font-weight: 600;
    flex: 1;
}

.export-btn-confirm {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: var(--green);
    opacity: 0;
    transition: opacity 0.2s;
    flex-shrink: 0;
}

.export-btn-confirm.visible {
    opacity: 1;
}

/* Transcript */
.transcript-toggle {
    width: 100%;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    padding: 0;
    color: var(--text);
}

.transcript-toggle:hover .card-title {
    color: var(--accent);
}

.expand-arrow {
    font-size: 16px;
    color: var(--text-muted);
    transition: transform 0.25s ease;
    display: inline-block;
}

.expand-arrow.rotated {
    transform: rotate(180deg);
}

.transcript-body {
    padding-top: 20px;
    border-top: 1px solid var(--border);
    margin-top: 4px;
}

.transcript-text {
    font-family: 'DM Mono', monospace;
    font-size: 12px;
    line-height: 1.7;
    color: var(--text-muted);
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 400px;
    overflow-y: auto;
}

/* Spinner (used by integrations send button) */
.spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgb(255 255 255 / 30%);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

/* ── Transitions ─────────────────────────────────────────────── */
.fade-up-enter-active {
    transition: all 0.5s ease 0.1s;
}

.fade-up-enter-from {
    opacity: 0;
    transform: translateY(16px);
}

.expand-enter-active,
.expand-leave-active {
    transition: opacity 0.25s ease;
}

.expand-enter-from,
.expand-leave-to {
    opacity: 0;
}
</style>
