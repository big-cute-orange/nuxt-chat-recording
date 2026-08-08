<script setup lang="ts">
import { isCompareError } from '~/composables/useCompare'
import type { ICompareResponse, IJudgeResponse } from '~/composables/useCompare'
import type { IMeetingSummary, TPriority, TProvider } from '~/types'

const props = defineProps<{
    compareResults: ICompareResponse
    submittedText: string
    providerName: (provider: TProvider) => string
    priorityConfig: Record<TPriority, { label: string; color: string; bg: string }>
    judgeResult: IJudgeResponse | null
    judgeLoading: boolean
}>()

const emit = defineEmits<{
    reset: []
}>()

const compareSides = ['a', 'b'] as const
const transcriptExpanded = ref(false)
const copiedKey = ref<string | null>(null)

const isError = isCompareError

const DIMENSIONS = [
    { key: 'completeness', label: '完整性' },
    { key: 'accuracy', label: '准确性' },
    { key: 'actionability', label: '可执行性' },
    { key: 'conciseness', label: '简洁性' },
] as const

function judgeProviderName(provider: string): string {
    return props.providerName(provider as TProvider)
}

function winnerLabel(): string {
    if (!props.judgeResult) return ''
    const { winner } = props.judgeResult

    if (winner === 'tie') return '平局'

    const side = winner === 'model_a' ? props.compareResults.a : props.compareResults.b

    return props.providerName(side.provider)
}

function scoreColor(scoreA: number, scoreB: number, isA: boolean): string {
    if (Math.abs(scoreA - scoreB) < 0.5) return 'neutral'

    return (isA ? scoreA > scoreB : scoreB > scoreA) ? 'win' : 'lose'
}

function valuesDiffer(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) !== JSON.stringify(b)
}

function getCompareResult(side: 'a' | 'b') {
    return props.compareResults?.[side]?.result
}

function getCompareDecisions(side: 'a' | 'b') {
    const result = getCompareResult(side)

    return result && !isError(result) ? (result.decisions ?? []) : []
}

function getCompareMeetingType(side: 'a' | 'b'): string {
    const result = getCompareResult(side)

    return result && !isError(result) ? result.meetingType : ''
}

function getCompareKeyTopics(side: 'a' | 'b'): string[] {
    const result = getCompareResult(side)

    return result && !isError(result) ? (result.keyTopics ?? []) : []
}

function getCompareSummary(side: 'a' | 'b'): string {
    const result = getCompareResult(side)

    return result && !isError(result) ? result.summary : ''
}

function getCompareActionItems(side: 'a' | 'b') {
    const result = getCompareResult(side)

    return result && !isError(result) ? (result.actionItems ?? []) : []
}

function getCompareResultAsAny(side: 'a' | 'b'): IMeetingSummary | undefined {
    const result = getCompareResult(side)

    return result && !isError(result) ? result : undefined
}

function flashCopied(key: string) {
    copiedKey.value = key
    setTimeout(() => {
        copiedKey.value = null
    }, 2000)
}

function buildMarkdown(s: IMeetingSummary, prov: string): string {
    const date = new Date().toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    })
    const lines: string[] = []

    lines.push(`# 会议纪要 — ${s.meetingType}`)
    lines.push(`*${date} · 分析模型：${prov}*`)
    lines.push('')
    lines.push('## 参与人')
    lines.push(s.participants.map((p) => `- ${p}`).join('\n'))
    lines.push('')
    lines.push('## 关键议题')
    lines.push(s.keyTopics.map((t) => `- ${t}`).join('\n'))
    lines.push('')
    lines.push('## 会议摘要')
    lines.push(s.summary)
    lines.push('')
    lines.push('## 行动项')

    s.actionItems.forEach((item) => {
        lines.push(`- **[${item.priority.toUpperCase()}]** ${item.task}`)
        lines.push(`  - 负责人：${item.owner}`)
        lines.push(`  - 截止日期：${item.deadline}`)
    })

    lines.push('')
    lines.push('## 决策事项')

    s.decisions.forEach((d, i) => {
        lines.push(`${i + 1}. **${d.decision}**`)
        if (d.rationale) lines.push(`   *${d.rationale}*`)
        lines.push(`   — ${d.madeBy}`)
    })

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

function downloadMarkdown(s: IMeetingSummary, prov: string, key: string) {
    const content = buildMarkdown(s, prov)
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')

    a.href = url
    a.download = `${s.meetingType.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
    flashCopied(key)
}
</script>

<template>
    <Transition name="fade-up" appear>
        <section class="compare-section">
            <div class="results-header">
                <div class="results-meta">
                    <span class="meeting-type-badge">对比模式</span>
                </div>
                <button type="button" class="reset-btn" @click="emit('reset')">← 新建会议</button>
            </div>

            <!-- ── Judge panel ──────────────────────────────────────────── -->
            <div v-if="judgeLoading || judgeResult" class="judge-panel">
                <!-- Skeleton -->
                <template v-if="judgeLoading">
                    <div class="judge-skeleton">
                        <div class="skeleton-title">
                            <span class="skeleton-title-icon">⚖</span>
                            <span>AI 裁判正在评估两个模型的输出质量...</span>
                        </div>
                        <div class="skeleton-header">
                            <div class="skeleton-bar w-24" />
                            <div class="skeleton-bar w-32" />
                        </div>
                        <div class="skeleton-rows">
                            <div v-for="i in 4" :key="i" class="skeleton-row">
                                <div class="skeleton-bar w-20" />
                                <div class="skeleton-bar w-full" />
                                <div class="skeleton-bar w-full" />
                            </div>
                        </div>
                        <div class="skeleton-bar w-48 skeleton-reason" />
                    </div>
                </template>

                <!-- Scores -->
                <template v-else-if="judgeResult">
                    <div class="judge-header">
                        <div class="judge-meta">
                            <span class="judge-label">裁判</span>
                            <span class="judge-provider-name">{{ judgeProviderName(judgeResult.judgeProvider) }}</span>
                        </div>
                        <div class="judge-winner">
                            <span class="winner-label">胜出</span>
                            <span :class="['winner-name', judgeResult.winner === 'tie' ? 'tie' : 'win']">
                                {{ winnerLabel() }}
                            </span>
                        </div>
                    </div>

                    <div class="judge-scores">
                        <div class="judge-score-col judge-score-labels">
                            <div class="judge-score-header-cell" />
                            <div v-for="dim in DIMENSIONS" :key="dim.key" class="judge-score-cell judge-dim-label">
                                {{ dim.label }}
                            </div>
                            <div class="judge-score-cell judge-overall-label">综合</div>
                        </div>

                        <div v-for="(side, idx) in ['a', 'b'] as const" :key="side" class="judge-score-col">
                            <div class="judge-score-header-cell judge-provider-header">
                                <span :class="['judge-side-badge', side]">{{ side.toUpperCase() }}</span>
                                <span class="judge-provider-label">{{ providerName(compareResults[side].provider) }}</span>
                            </div>
                            <div
                                v-for="dim in DIMENSIONS"
                                :key="dim.key"
                                :class="[
                                    'judge-score-cell',
                                    'judge-score-value',
                                    scoreColor(judgeResult.scores.model_a[dim.key], judgeResult.scores.model_b[dim.key], idx === 0),
                                ]"
                            >
                                <span class="score-number">
                                    {{ (idx === 0 ? judgeResult.scores.model_a : judgeResult.scores.model_b)[dim.key] }}
                                </span>
                                <div class="score-bar-track">
                                    <div
                                        class="score-bar-fill"
                                        :style="{
                                            width:
                                                ((idx === 0 ? judgeResult.scores.model_a : judgeResult.scores.model_b)[dim.key] / 10) *
                                                    100 +
                                                '%',
                                        }"
                                    />
                                </div>
                            </div>
                            <div
                                :class="[
                                    'judge-score-cell',
                                    'judge-overall-value',
                                    judgeResult.winner === 'tie'
                                        ? 'neutral'
                                        : (idx === 0 ? judgeResult.winner === 'model_a' : judgeResult.winner === 'model_b')
                                          ? 'win'
                                          : 'lose',
                                ]"
                            >
                                {{ (idx === 0 ? judgeResult.scores.model_a : judgeResult.scores.model_b).overall }}
                                <span
                                    v-if="idx === 0 ? judgeResult.winner === 'model_a' : judgeResult.winner === 'model_b'"
                                    class="winner-check"
                                >
                                    ✓
                                </span>
                            </div>
                        </div>
                    </div>

                    <p class="judge-reason">{{ judgeResult.reason }}</p>
                </template>
            </div>

            <div class="compare-grid">
                <div v-for="side in compareSides" :key="side" class="compare-col">
                    <div class="compare-col-header">
                        <span class="compare-side-badge" :class="side">
                            {{ side.toUpperCase() }}
                        </span>
                        <span class="compare-provider-name">{{ props.providerName(props.compareResults[side].provider) }}</span>
                    </div>

                    <div v-if="isError(props.compareResults[side].result)" class="compare-error">
                        ⚠ {{ props.compareResults[side].result.error }}
                    </div>

                    <template v-else>
                        <div class="compare-result">
                            <div
                                class="compare-field"
                                :class="{
                                    differs: valuesDiffer(
                                        !isError(props.compareResults.a.result) ? props.compareResults.a.result?.meetingType : undefined,
                                        !isError(props.compareResults.b.result) ? props.compareResults.b.result?.meetingType : undefined
                                    ),
                                }"
                            >
                                <span class="compare-field-label">会议类型</span>
                                <span class="compare-field-value">{{ getCompareMeetingType(side) }}</span>
                            </div>

                            <div
                                class="compare-field"
                                :class="{
                                    differs: valuesDiffer(
                                        !isError(props.compareResults.a.result) ? props.compareResults.a.result?.keyTopics : undefined,
                                        !isError(props.compareResults.b.result) ? props.compareResults.b.result?.keyTopics : undefined
                                    ),
                                }"
                            >
                                <span class="compare-field-label">讨论主题</span>
                                <div class="compare-chips">
                                    <span v-for="t in getCompareKeyTopics(side)" :key="t" class="chip chip-purple">{{ t }}</span>
                                </div>
                            </div>

                            <div
                                class="compare-field"
                                :class="{
                                    differs: valuesDiffer(
                                        !isError(props.compareResults.a.result) ? props.compareResults.a.result?.summary : undefined,
                                        !isError(props.compareResults.b.result) ? props.compareResults.b.result?.summary : undefined
                                    ),
                                }"
                            >
                                <span class="compare-field-label">执行摘要</span>
                                <p class="compare-summary">{{ getCompareSummary(side) }}</p>
                            </div>

                            <div
                                class="compare-field"
                                :class="{
                                    differs: valuesDiffer(
                                        !isError(props.compareResults.a.result)
                                            ? props.compareResults.a.result?.actionItems?.length
                                            : undefined,
                                        !isError(props.compareResults.b.result)
                                            ? props.compareResults.b.result?.actionItems?.length
                                            : undefined
                                    ),
                                }"
                            >
                                <span class="compare-field-label">
                                    行动项
                                    <span class="compare-count-badge">{{ getCompareActionItems(side).length }}</span>
                                </span>
                                <div class="compare-action-list">
                                    <div v-for="(item, i) in getCompareActionItems(side)" :key="i" class="compare-action-item">
                                        <span
                                            class="priority-badge"
                                            :style="{
                                                color: props.priorityConfig[item.priority]?.color ?? '#fff',
                                                background: props.priorityConfig[item.priority]?.bg ?? 'rgba(255,255,255,0.05)',
                                            }"
                                        >
                                            {{ props.priorityConfig[item.priority]?.label ?? item.priority }}
                                        </span>
                                        <div class="compare-action-body">
                                            <span class="compare-action-task">{{ item.task }}</span>
                                            <span class="compare-action-meta">👤 {{ item.owner }} · 📅 {{ item.deadline }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div
                                class="compare-field"
                                :class="{
                                    differs: valuesDiffer(
                                        !isError(props.compareResults.a.result)
                                            ? props.compareResults.a.result?.decisions?.length
                                            : undefined,
                                        !isError(props.compareResults.b.result)
                                            ? props.compareResults.b.result?.decisions?.length
                                            : undefined
                                    ),
                                }"
                            >
                                <span class="compare-field-label">
                                    决策事项
                                    <span class="compare-count-badge">{{ getCompareDecisions(side).length }}</span>
                                </span>
                                <div class="compare-decision-list">
                                    <div v-for="(d, i) in getCompareDecisions(side)" :key="i" class="compare-decision-item">
                                        <span class="decision-number">{{ String(i + 1).padStart(2, '0') }}</span>
                                        <div>
                                            <p class="decision-text">{{ d.decision }}</p>
                                            <p v-if="d.rationale" class="decision-rationale">{{ d.rationale }}</p>
                                            <span class="decision-by">— {{ d.madeBy }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="compare-field">
                                <span class="compare-field-label">导出</span>
                                <div class="export-actions">
                                    <button
                                        v-if="getCompareResultAsAny(side)"
                                        type="button"
                                        class="export-btn"
                                        @click="
                                            () => {
                                                const result = getCompareResultAsAny(side)
                                                if (result)
                                                    copyToClipboard(
                                                        buildMarkdown(result, props.providerName(props.compareResults[side].provider)),
                                                        `md-${side}`
                                                    )
                                            }
                                        "
                                    >
                                        <span class="export-btn-icon">◻</span>
                                        <span class="export-btn-label">复制为 Markdown</span>
                                        <span class="export-btn-confirm" :class="{ visible: copiedKey === `md-${side}` }">✓ 已复制</span>
                                    </button>
                                    <button
                                        v-if="getCompareResultAsAny(side)"
                                        type="button"
                                        class="export-btn"
                                        @click="
                                            () => {
                                                const result = getCompareResultAsAny(side)
                                                if (result)
                                                    downloadMarkdown(
                                                        result,
                                                        props.providerName(props.compareResults[side].provider),
                                                        `download-${side}`
                                                    )
                                            }
                                        "
                                    >
                                        <span class="export-btn-icon">↓</span>
                                        <span class="export-btn-label">下载 .md 文件</span>
                                        <span class="export-btn-confirm" :class="{ visible: copiedKey === `download-${side}` }">
                                            ✓ 已完成
                                        </span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </template>
                </div>
            </div>

            <div class="card compare-transcript-card">
                <button type="button" class="transcript-toggle" @click="transcriptExpanded = !transcriptExpanded">
                    <div class="card-header transcript-card-header">
                        <span class="card-icon">≡</span>
                        <h2 class="card-title">会议纪要原文</h2>
                        <span class="card-count">{{ props.submittedText.length.toLocaleString() }} 字符数</span>
                        <span class="expand-arrow" :class="{ rotated: transcriptExpanded }">▾</span>
                    </div>
                </button>
                <Transition name="expand">
                    <div v-if="transcriptExpanded" class="transcript-body">
                        <pre class="transcript-text">{{ props.submittedText }}</pre>
                    </div>
                </Transition>
            </div>
        </section>
    </Transition>
</template>

<style scoped>
.compare-section {
    display: flex;
    flex-direction: column;
    gap: 0;
}

.compare-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-top: 24px;
}

@media (width <= 700px) {
    .compare-grid {
        grid-template-columns: 1fr;
    }
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

.compare-col {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 14px;
    overflow: hidden;
}

.compare-col-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
}

.compare-side-badge {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    font-weight: 700;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.compare-side-badge.a {
    background: rgb(91 196 255 / 15%);
    color: var(--blue);
    border: 1px solid rgb(91 196 255 / 30%);
}

.compare-side-badge.b {
    background: rgb(124 109 255 / 15%);
    color: var(--accent);
    border: 1px solid rgb(124 109 255 / 30%);
}

.compare-provider-name {
    font-size: 15px;
    font-weight: 700;
}

.compare-error {
    padding: 24px 20px;
    color: var(--red);
    font-size: 13px;
}

.compare-field {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    transition: background 0.2s;
}

.compare-field:last-child {
    border-bottom: none;
}

.compare-field.differs {
    background: rgb(255 179 71 / 4%);
    border-left: 3px solid var(--amber);
    padding-left: 17px;
}

.compare-field-label {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
}

.compare-count-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--bg-hover);
    border: 1px solid var(--border-bright);
    color: var(--text-muted);
    font-size: 10px;
}

.compare-field-value {
    font-size: 13px;
    font-weight: 600;
}

.chip {
    font-size: 12px;
    font-weight: 600;
    padding: 4px 12px;
    border-radius: 20px;
}

.chip-purple {
    background: var(--accent-glow);
    color: var(--accent);
    border: 1px solid rgb(124 109 255 / 20%);
}

.compare-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.compare-summary {
    font-size: 13px;
    line-height: 1.7;
    color: var(--text);
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

.compare-result {
    display: flex;
    flex-direction: column;
}

.compare-action-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.compare-action-item {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 10px 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
}

.compare-action-body {
    display: flex;
    flex-direction: column;
    gap: 3px;
}

.compare-action-task {
    font-size: 12px;
    line-height: 1.4;
}

.compare-action-meta {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    color: var(--text-muted);
}

.compare-decision-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.compare-decision-item {
    display: flex;
    gap: 12px;
    padding: 10px 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
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

.compare-transcript-card {
    margin-top: 20px;
}

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

.transcript-card-header {
    margin-bottom: 0;
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
    overflow-wrap: anywhere;
    max-height: 400px;
    overflow-y: auto;
}

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

.fade-up-enter-active {
    transition: all 0.5s ease 0.1s;
}

.fade-up-enter-from {
    opacity: 0;
    transform: translateY(16px);
}

/* ── Judge panel ─────────────────────────────────────────────── */
.judge-panel {
    margin-top: 24px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 14px;
    overflow: hidden;
    min-height: 48px;
}

/* Skeleton */
.judge-skeleton {
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.skeleton-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-muted);
    font-weight: 500;
}

.skeleton-title-icon {
    font-size: 15px;
}

.skeleton-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.skeleton-rows {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.skeleton-row {
    display: grid;
    grid-template-columns: 100px 1fr 1fr;
    gap: 12px;
    align-items: center;
}

.skeleton-bar {
    height: 10px;
    border-radius: 6px;
    background: var(--border);
    animation: shimmer 1.4s ease-in-out infinite;
}

.skeleton-reason {
    margin-top: 4px;
}

.w-20 {
    width: 80px;
}

.w-24 {
    width: 96px;
}

.w-32 {
    width: 128px;
}

.w-48 {
    width: 192px;
}

.w-full {
    width: 100%;
}

@keyframes shimmer {
    0%,
    100% {
        opacity: 0.4;
    }

    50% {
        opacity: 0.9;
    }
}

/* Header row */
.judge-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    border-bottom: 1px solid var(--border);
}

.judge-meta {
    display: flex;
    align-items: center;
    gap: 8px;
}

.judge-label {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
}

.judge-provider-name {
    font-size: 13px;
    font-weight: 700;
    color: var(--text);
}

.judge-winner {
    display: flex;
    align-items: center;
    gap: 8px;
}

.winner-label {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
}

.winner-name {
    font-size: 13px;
    font-weight: 700;
    padding: 3px 12px;
    border-radius: 20px;
}

.winner-name.win {
    background: rgb(22 163 74 / 12%);
    color: var(--green);
    border: 1px solid rgb(22 163 74 / 25%);
}

.winner-name.tie {
    background: var(--bg-hover);
    color: var(--text-muted);
    border: 1px solid var(--border-bright);
}

/* Score grid */
.judge-scores {
    display: grid;
    grid-template-columns: 120px 1fr 1fr;
    padding: 16px 20px;
    gap: 0;
}

.judge-score-col {
    display: flex;
    flex-direction: column;
}

.judge-score-header-cell {
    height: 32px;
    display: flex;
    align-items: center;
    margin-bottom: 4px;
}

.judge-provider-header {
    gap: 8px;
}

.judge-side-badge {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    width: 20px;
    height: 20px;
    border-radius: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.judge-side-badge.a {
    background: rgb(91 196 255 / 15%);
    color: var(--blue);
    border: 1px solid rgb(91 196 255 / 30%);
}

.judge-side-badge.b {
    background: rgb(124 109 255 / 15%);
    color: var(--accent);
    border: 1px solid rgb(124 109 255 / 30%);
}

.judge-provider-label {
    font-size: 13px;
    font-weight: 700;
}

.judge-score-cell {
    height: 36px;
    display: flex;
    align-items: center;
    border-top: 1px solid var(--border);
}

.judge-dim-label {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding-right: 12px;
}

.judge-overall-label {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding-right: 12px;
    font-weight: 700;
    border-top: 1px solid var(--border-bright);
}

.judge-score-value {
    gap: 10px;
    padding: 0 16px 0 4px;
}

.judge-overall-value {
    font-family: 'DM Mono', monospace;
    font-size: 15px;
    font-weight: 700;
    padding: 0 16px 0 4px;
    gap: 6px;
    border-top: 1px solid var(--border-bright);
}

.score-number {
    font-family: 'DM Mono', monospace;
    font-size: 13px;
    font-weight: 500;
    width: 18px;
    flex-shrink: 0;
}

.score-bar-track {
    flex: 1;
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    overflow: hidden;
}

.score-bar-fill {
    height: 100%;
    border-radius: 2px;
    background: var(--border-bright);
    transition: width 0.6s ease;
}

.winner-check {
    font-size: 12px;
}

/* Score color states */
.judge-score-value.win .score-number,
.judge-overall-value.win {
    color: var(--green);
}

.judge-score-value.win .score-bar-fill {
    background: var(--green);
}

.judge-score-value.lose .score-number,
.judge-overall-value.lose {
    color: var(--text-muted);
}

.judge-score-value.neutral .score-number {
    color: var(--text);
}

.judge-overall-value.win .winner-check {
    color: var(--green);
}

/* Reason */
.judge-reason {
    padding: 12px 20px 16px;
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.6;
    border-top: 1px solid var(--border);
    font-style: italic;
}
</style>
