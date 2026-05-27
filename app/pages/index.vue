<script setup lang="ts">
import type { TProvider, IMeetingSummary, TInputType, IHistoryEntry } from '~/types/index';

const { summarize, result, loading, error, progress, reset } = useSummarizer();
const { compare, results: compareResults, loading: compareLoading, error: compareError, reset: compareReset } = useCompare();
const {
    transcribe,
    result: transcribeResult,
    loading: transcribeLoading,
    error: transcribeError,
    uploadProgress,
    reset: transcribeReset,
} = useTranscribe();
const {
    enabledIntegrations,
    hasIntegrations,
    status: intStatus,
    sendTo,
    integrationMeta,
    loadConfig: loadIntegrations,
} = useIntegrations();
const {
    history,
    total: historyTotal,
    loading: historyLoading,
    hasMore: historyHasMore,
    load: historyLoad,
    loadMore: historyLoadMore,
    add: historyAdd,
    update: historyUpdate,
    remove: historyRemove,
    clear: historyClear,
    migrateFromLocalStorage,
} = useHistory();

// ── Mode ──────────────────────────────────────────────────────────────────────
const mode = ref<'single' | 'compare'>('single');

function switchMode(m: 'single' | 'compare') {
    mode.value = m;
    handleReset();
}

// ── State ─────────────────────────────────────────────────────────────────────
const transcriptText = ref('');
const submittedText = ref('');
const provider = ref<TProvider>('deepseek');
const compareProviders = ref<[TProvider, TProvider]>(['deepseek', 'qwen']);
const inputMode = ref<'paste' | 'upload' | 'audio' | 'free-notes'>('paste');
const inputType = ref<TInputType>('transcript');

// Keep inputType in sync with inputMode
watch(inputMode, (mode: string) => {
    inputType.value = mode === 'free-notes' ? 'free-notes' : 'transcript';
});

const audioFile = ref<File | null>(null);
const transcribing = ref(false);
const transcribeStep = ref<'idle' | 'uploading' | 'done'>('idle');
const fileName = ref('');
const dragOver = ref(false);
// Convenience computed for "is anything loading"
const isLoading = computed(() => loading.value || compareLoading.value || transcribeLoading.value);
const activeError = computed(() => error.value || compareError.value || transcribeError.value);
const hasResult = computed(() => !!result.value || !!compareResults.value);

// ── History ───────────────────────────────────────────────────────────────────
const activeHistoryId = ref<string | null>(null);

async function onDeleteHistoryEntry(id: string) {
    await historyRemove(id);

    if (activeHistoryId.value === id) {
        activeHistoryId.value = null;
        reset();
        submittedText.value = '';
    }
}

function openHistoryEntry(entry: IHistoryEntry) {
    activeHistoryId.value = entry.id;
    submittedText.value = entry.transcript;
    provider.value = entry.provider;
    mode.value = 'single';
    reset();
    nextTick(() => {
        result.value = entry.summary;
    });
}

onMounted(async () => {
    loadIntegrations();
    await migrateFromLocalStorage();
    await historyLoad();
});

// ── File parsers ──────────────────────────────────────────────────────────────
function parseVtt(raw: string): string {
    const lines = raw.split('\n');
    const out: string[] = [];
    let currentSpeaker = '';
    let currentText = '';

    for (const line of lines) {
        const t = line.trim();

        if (!t || t === 'WEBVTT' || t.startsWith('NOTE') || t.startsWith('STYLE')) {
            continue;
        }

        if (/^\d{2}:[\d:.]+\s*-->\s*[\d:.]+/.test(t)) {
            continue;
        }

        if (/^\d+$/.test(t)) {
            continue;
        }

        const m = t.match(/^<v ([^>]+)>(.*)$/);

        if (m && m[1] && m[2]) {
            const speaker = m[1].trim();
            const text = m[2].replace(/<[^>]+>/g, '').trim();

            if (speaker !== currentSpeaker) {
                if (currentText) {
                    out.push(`${currentSpeaker}: ${currentText}`);
                }

                currentSpeaker = speaker;
                currentText = text;
            } else {
                currentText += ' ' + text;
            }
        } else {
            const text = t.replace(/<[^>]+>/g, '').trim();

            if (text) {
                currentText += ' ' + text;
            }
        }
    }

    if (currentText) {
        out.push(currentSpeaker ? `${currentSpeaker}: ${currentText}` : currentText);
    }

    return out.join('\n');
}

function parseSrt(raw: string): string {
    const lines = raw.split('\n');
    const out: string[] = [];

    for (const line of lines) {
        const t = line.trim();

        if (!t || /^\d+$/.test(t) || /^\d{2}:\d{2}:\d{2}[,.]?\d*\s*-->\s*\d{2}:\d{2}:\d{2}/.test(t)) {
            continue;
        }

        out.push(t);
    }

    const merged: string[] = [];

    for (const line of out) {
        if (merged[merged.length - 1] !== line) {
            merged.push(line);
        }
    }

    return merged.join('\n');
}

async function handleFile(file: File) {
    if (!file) {
        return;
    }

    fileName.value = file.name;
    const name = file.name.toLowerCase();

    if (name.endsWith('.txt')) {
        transcriptText.value = await file.text();
    } else if (name.endsWith('.vtt')) {
        transcriptText.value = parseVtt(await file.text());
    } else if (name.endsWith('.srt')) {
        transcriptText.value = parseSrt(await file.text());
    } else if (name.endsWith('.docx')) {
        const mammoth = await import('mammoth');
        const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });

        transcriptText.value = value;
    } else {
        fileName.value = '';
        alert('不支持的文件格式，请上传 .txt / .docx / .vtt / .srt');
        return;
    }

    inputMode.value = 'paste';
}

function handleDrop(e: DragEvent) {
    dragOver.value = false;
    const file = e.dataTransfer?.files[0];

    if (file) {
        handleFile(file);
    }
}

function handleFileInput(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];

    if (file) {
        handleFile(file);
    }
}

// Handle audio/video file selection for Whisper
function handleAudioFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];

    if (!file) {
        return;
    }

    audioFile.value = file;
    transcribeStep.value = 'idle';
    transcribeReset();
    transcriptText.value = '';
}

function handleAudioDrop(e: DragEvent) {
    const file = e.dataTransfer?.files[0];

    if (!file) {
        return;
    }

    audioFile.value = file;
    transcribeStep.value = 'idle';
    transcribeReset();
    transcriptText.value = '';
}

async function handleTranscribe() {
    if (!audioFile.value) {
        return;
    }

    transcribing.value = true;
    transcribeStep.value = 'uploading';
    const text = await transcribe(audioFile.value);

    if (text) {
        transcriptText.value = text;
        transcribeStep.value = 'done';
        inputMode.value = 'paste';
    } else {
        transcribeStep.value = 'idle';
    }

    transcribing.value = false;
}

// ── Submit & reset ────────────────────────────────────────────────────────────
async function handleSubmit() {
    if (!transcriptText.value.trim()) {
        return;
    }

    submittedText.value = transcriptText.value;
    activeHistoryId.value = null;

    if (mode.value === 'single') {
        await summarize(transcriptText.value, provider.value, inputType.value);

        if (result.value) {
            activeHistoryId.value = await historyAdd(result.value, submittedText.value, provider.value);
        }
    } else {
        await compare(transcriptText.value, compareProviders.value);
    }
}

function handleReset() {
    reset();
    compareReset();
    transcribeReset();
    transcriptText.value = '';
    submittedText.value = '';
    fileName.value = '';
    audioFile.value = null;
    transcribeStep.value = 'idle';
    activeHistoryId.value = null;
}

// ── Single result save handler ────────────────────────────────────────────────
function onSingleResultSaveEdit(updated: IMeetingSummary) {
    result.value = { ...updated };

    if (activeHistoryId.value) {
        const idx = history.value.findIndex((e: IHistoryEntry) => e.id === activeHistoryId.value);
        const entry = history.value[idx];

        if (idx !== -1 && entry) {
            entry.summary = { ...updated };
            entry.meetingType = updated.meetingType;
        }

        historyUpdate(activeHistoryId.value, updated).catch((err: unknown) => {
            console.warn('[saveEdits] Failed to persist edit:', err);
        });
    }
}

// ── Display helpers ───────────────────────────────────────────────────────────
const priorityConfig = {
    high: { label: 'High', color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
    medium: { label: 'Medium', color: '#d97706', bg: 'rgba(217,119,6,0.1)' },
    low: { label: 'Low', color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
};

const providers = [
    { id: 'deepseek', label: 'DeepSeek' },
    { id: 'qwen', label: '通义千问' },
    { id: 'doubao', label: '豆包' },
];

const providerLabel = computed(() => providers.find((p) => p.id === provider.value)?.label ?? provider.value);

function providerName(id: TProvider) {
    return providers.find((p) => p.id === id)?.label ?? id;
}

// Toggle a provider in the compare pair
function toggleCompareProvider(id: TProvider) {
    const [a, b] = compareProviders.value;

    if (a === id) {
        // swap a with the third option
        const third = providers.find((p) => p.id !== a && p.id !== b)!;

        compareProviders.value = [third.id, b];
    } else if (b === id) {
        const third = providers.find((p) => p.id !== a && p.id !== b)!;

        compareProviders.value = [a, third.id];
    }
}

function isCompareProviderDisabled(id: TProvider): boolean {
    return (
        compareProviders.value.includes(id) &&
        compareProviders.value.filter((x: TProvider) => x === id).length === 1 &&
        compareProviders.value.length === 2
    );
}
</script>

<template>
    <div class="app">
        <!-- ── Header ─────────────────────────────────────────────── -->
        <header class="header">
            <div class="header-inner">
                <div class="logo">
                    <span class="logo-icon">◈</span>
                    <span class="logo-text">AI</span>
                    <span class="logo-tag">智能会议纪要助手</span>
                </div>
                <div class="header-right">
                    <NuxtLink to="/dashboard" class="history-btn">
                        <span class="history-btn-icon">▤</span>
                        数据看板
                    </NuxtLink>

                    <!-- <NuxtLink to="/integrations" class="history-btn">
                        <span class="history-btn-icon">⇄</span>
                        Integrations
                    </NuxtLink> -->

                    <HistorySidebar
                        :history="history"
                        :history-total="historyTotal"
                        :active-history-id="activeHistoryId"
                        :history-has-more="historyHasMore"
                        :history-loading="historyLoading"
                        :provider-name="providerName"
                        :format-date="formatDate"
                        @clear="historyClear"
                        @load-more="historyLoadMore"
                        @open-entry="openHistoryEntry"
                        @delete-entry="onDeleteHistoryEntry"
                    />

                    <!-- Mode toggle -->
                    <div class="mode-toggle">
                        <button :class="['mode-btn', mode === 'single' ? 'active' : '']" @click="switchMode('single')">单个分析</button>
                        <button :class="['mode-btn', mode === 'compare' ? 'active' : '']" @click="switchMode('compare')">⇄ 对比分析</button>
                    </div>

                    <!-- Provider selector (single mode only) -->
                    <div v-if="mode === 'single'" class="provider-toggle">
                        <button
                            v-for="p in providers"
                            :key="p.id"
                            :class="['toggle-btn', provider === p.id ? 'active' : '']"
                            @click="provider = p.id"
                        >
                            <span class="toggle-dot" />
                            {{ p.label }}
                        </button>
                    </div>

                    <!-- Provider selector (compare mode) -->
                    <div v-if="mode === 'compare'" class="provider-toggle compare-providers">
                        <button
                            v-for="p in providers"
                            :key="p.id"
                            :class="['toggle-btn', compareProviders.includes(p.id) ? 'active' : 'inactive']"
                            :disabled="isCompareProviderDisabled(p.id)"
                            @click="
                                compareProviders.includes(p.id)
                                    ? toggleCompareProvider(p.id)
                                    : (compareProviders = [compareProviders[0], p.id])
                            "
                        >
                            <span class="toggle-dot" />
                            {{ p.label }}
                            <span v-if="compareProviders[0] === p.id" class="compare-label">A</span>
                            <span v-else-if="compareProviders[1] === p.id" class="compare-label">B</span>
                        </button>
                    </div>
                    <AuthButton />
                </div>
            </div>
        </header>

        <!-- ── Main ───────────────────────────────────────────────── -->
        <main class="main">
            <!-- ── Input section ──────────────────────────────────────── -->
            <Transition name="slide-up">
                <section v-if="!hasResult" class="input-section">
                    <div class="hero">
                        <h1 class="hero-title">
                            <template v-if="mode === 'single'">
                                让会议成果
                                <br />
                                <em>快速落地</em>
                            </template>
                            <template v-else>
                                AI 会议分析
                                <br />
                                <em>对比</em>
                            </template>
                        </h1>
                        <p class="hero-sub">
                            <template v-if="mode === 'single'">粘贴会议纪要原文或上传文件，AI 自动提取所有关键信息</template>
                            <template v-else>
                                上传会议记录，对比
                                <strong>{{ providerName(compareProviders[0]) }}</strong>
                                和
                                <strong>{{ providerName(compareProviders[1]) }}</strong>
                                的分析结果
                            </template>
                        </p>
                    </div>

                    <div class="input-tabs">
                        <button :class="['tab', inputMode === 'paste' ? 'active' : '']" @click="inputMode = 'paste'">粘贴文本</button>
                        <button :class="['tab', inputMode === 'upload' ? 'active' : '']" @click="inputMode = 'upload'">上传文件</button>
                        <!-- <button :class="['tab', inputMode === 'audio' ? 'active' : '']" @click="inputMode = 'audio'">
                            🎙 Audio / Video
                        </button> -->
                        <!-- <button :class="['tab', inputMode === 'free-notes' ? 'active' : '']" @click="inputMode = 'free-notes'">
                            ✏ Free notes
                        </button> -->
                    </div>

                    <div v-if="inputMode === 'paste'" class="input-area">
                        <textarea v-model="transcriptText" class="textarea" placeholder="请在此粘贴会议纪要原文..." rows="12" />
                        <div class="textarea-footer">
                            <span class="char-count">{{ transcriptText.length.toLocaleString() }} 字符数</span>
                        </div>
                    </div>

                    <div
                        v-if="inputMode === 'upload'"
                        class="dropzone"
                        :class="{ 'drag-active': dragOver }"
                        @dragover.prevent="dragOver = true"
                        @dragleave="dragOver = false"
                        @drop.prevent="handleDrop"
                    >
                        <input type="file" accept=".txt,.docx,.vtt,.srt" class="file-input" @change="handleFileInput" />
                        <div class="dropzone-content">
                            <span class="dropzone-icon">⬆</span>
                            <p class="dropzone-label">{{ fileName || '将文件拖拽到这里，或点击上传' }}</p>
                            <p class="dropzone-hint">.txt · .docx · .vtt · .srt</p>
                        </div>
                    </div>

                    <!-- Audio / Video upload for Whisper -->
                    <div v-if="inputMode === 'audio'" class="audio-section">
                        <!-- Drop zone for audio -->
                        <div
                            v-if="transcribeStep !== 'done'"
                            class="dropzone audio-dropzone"
                            @dragover.prevent
                            @drop.prevent="handleAudioDrop"
                        >
                            <input type="file" accept=".mp3,.mp4,.m4a,.wav,.webm,.ogg,.mpeg" class="file-input" @change="handleAudioFile" />
                            <div class="dropzone-content">
                                <span class="dropzone-icon">🎙</span>
                                <p class="dropzone-label">{{ audioFile ? audioFile.name : 'Drop audio or video file here' }}</p>
                                <p class="dropzone-hint">.mp3 · .mp4 · .m4a · .wav · .webm · .ogg · max 25MB</p>
                                <p v-if="audioFile" class="audio-filesize">{{ (audioFile.size / 1024 / 1024).toFixed(1) }} MB</p>
                            </div>
                        </div>

                        <!-- Requires OpenAI key notice -->
                        <div class="whisper-notice">
                            <span class="whisper-notice-icon">ℹ</span>
                            Transcription uses
                            <strong>OpenAI Whisper</strong>
                            — requires an OpenAI API key regardless of the selected provider.
                        </div>

                        <!-- Transcribe button -->
                        <button
                            v-if="audioFile && transcribeStep !== 'done' && !transcribing"
                            class="transcribe-btn"
                            @click="handleTranscribe"
                        >
                            Transcribe with Whisper →
                        </button>

                        <!-- Progress during transcription -->
                        <div v-if="transcribing" class="transcribe-progress">
                            <div class="transcribe-progress-header">
                                <span class="spinner-text">
                                    <span class="spinner" />
                                    {{ uploadProgress < 60 ? 'Uploading...' : 'Transcribing with Whisper...' }}
                                </span>
                                <span class="transcribe-pct">{{ uploadProgress }}%</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill" :style="{ width: uploadProgress + '%' }" />
                            </div>
                        </div>

                        <!-- Transcription done — preview -->
                        <div v-if="transcribeResult && transcribeStep === 'done' && inputMode === 'audio'" class="transcribe-success">
                            ✓ Transcribed successfully — ready to analyse
                            <span v-if="transcribeResult.duration" class="transcribe-meta">
                                · {{ Math.round(transcribeResult.duration / 60) }}min · {{ transcribeResult.language }}
                            </span>
                        </div>
                    </div>

                    <!-- Free notes mode -->
                    <div v-if="inputMode === 'free-notes'" class="input-area free-notes-area">
                        <div class="free-notes-header">
                            <span class="free-notes-badge">✏ Free notes mode</span>
                            <span class="free-notes-hint">Write anything — the AI will structure it</span>
                        </div>
                        <textarea
                            v-model="transcriptText"
                            class="textarea free-notes-textarea"
                            placeholder="e.g.
- sarah, tom, ana, james
- sprint review, showed demo to client acme
- bug on login page BLOCKING - tom to fix asap
- decided to move launch to march 15
- ana to prep deck for board meeting next fri
- discussed perf issues, james says needs refactor, low prio
- client happy overall, wants dark mode eventually"
                            rows="14"
                        />
                        <div class="textarea-footer">
                            <span class="char-count">{{ transcriptText.length.toLocaleString() }} characters</span>
                            <span class="free-notes-tip">Abbreviations, bullet points, fragments — all fine</span>
                        </div>
                    </div>

                    <div v-if="activeError" class="error-msg">⚠ {{ activeError }}</div>

                    <button class="submit-btn" :disabled="isLoading || !transcriptText.trim()" @click="handleSubmit">
                        <span v-if="!isLoading">
                            {{
                                mode === 'compare'
                                    ? `对比 ${providerName(compareProviders[0])} vs ${providerName(compareProviders[1])} →`
                                    : inputMode === 'free-notes'
                                      ? '将笔记整理成结构化内容 →'
                                      : '分析会议 →'
                            }}
                        </span>
                        <span v-else class="loading-state">
                            <span class="spinner" />
                            {{ mode === 'single' ? `分析中... ${progress}%` : '正在对比模型结果...' }}
                        </span>
                    </button>

                    <div v-if="loading" class="progress-bar">
                        <div class="progress-fill" :style="{ width: progress + '%' }" />
                    </div>
                </section>
            </Transition>

            <!-- ── Single result ───────────────────────────────────────── -->
            <SingleResultSection
                v-if="result && mode === 'single'"
                :result="result!"
                :submitted-text="submittedText"
                :provider-label="providerLabel"
                :priority-config="priorityConfig"
                :active-history-id="activeHistoryId"
                :has-integrations="hasIntegrations"
                :enabled-integrations="enabledIntegrations"
                :integration-meta="integrationMeta"
                :int-status="intStatus"
                :send-to="sendTo"
                @reset="handleReset"
                @save-edit="onSingleResultSaveEdit"
            />

            <!-- ── Compare results ─────────────────────────────────────── -->
            <CompareResultsSection
                v-if="compareResults && mode === 'compare'"
                :compare-results="compareResults!"
                :submitted-text="submittedText"
                :provider-name="providerName"
                :priority-config="priorityConfig"
                @reset="handleReset"
            />
        </main>
    </div>
</template>

<style scoped>
.app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}

/* ── Header nav buttons ──────────────────────────────────────── */
.history-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text-muted);
    font-family: Syne, sans-serif;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
    text-decoration: none;
}

.history-btn:hover {
    border-color: var(--accent);
    color: var(--text);
}

.history-btn-icon {
    font-size: 15px;
}

/* ── Header ──────────────────────────────────────────────────── */
.header {
    border-bottom: 1px solid var(--border);
    backdrop-filter: blur(12px);
    position: sticky;
    top: 0;
    z-index: 100;
    background: rgb(10 10 15 / 85%);
}

.header-inner {
    max-width: 1100px;
    margin: 0 auto;
    padding: 12px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
}

.logo {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
}

.logo-icon {
    color: var(--accent);
    font-size: 20px;
}

.logo-text {
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.5px;
}

.logo-tag {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: var(--text-muted);
    border: 1px solid var(--border-bright);
    padding: 2px 7px;
    border-radius: 20px;
    letter-spacing: 0.05em;
}

.header-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}

/* Mode toggle */
.mode-toggle {
    display: flex;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 3px;
    gap: 2px;
}

.mode-btn {
    padding: 6px 14px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-family: Syne, sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
    background: transparent;
    transition: all 0.2s;
    white-space: nowrap;
}

.mode-btn.active {
    background: var(--accent-soft);
    color: var(--text);
}

/* Provider toggle */
.provider-toggle {
    display: flex;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 3px;
    gap: 2px;
}

.toggle-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-family: Syne, sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
    background: transparent;
    transition: all 0.2s;
}

.toggle-btn.active {
    background: var(--accent-soft);
    color: var(--text);
}

.toggle-btn.inactive {
    opacity: 0.4;
}

.toggle-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentcolor;
    opacity: 0.7;
    flex-shrink: 0;
}

.compare-label {
    font-family: 'DM Mono', monospace;
    font-size: 9px;
    background: rgb(255 255 255 / 15%);
    padding: 1px 4px;
    border-radius: 3px;
    margin-left: 2px;
}

/* ── Main ────────────────────────────────────────────────────── */
.main {
    flex: 1;
    max-width: 1100px;
    margin: 0 auto;
    padding: 48px 24px;
    width: 100%;
}

.hero {
    text-align: center;
    margin-bottom: 48px;
}

.hero-title {
    font-size: clamp(32px, 5vw, 60px);
    font-weight: 800;
    line-height: 1.05;
    letter-spacing: -2px;
    margin-bottom: 16px;
}

.hero-title em {
    font-style: normal;
    background: linear-gradient(135deg, var(--accent) 0%, var(--blue) 100%);
    background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.hero-sub {
    font-size: 16px;
    color: var(--text-muted);
    max-width: 480px;
    margin: 0 auto;
    line-height: 1.6;
}

.hero-sub strong {
    color: var(--text);
}

.input-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 16px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 4px;
    width: fit-content;
}

.tab {
    padding: 8px 20px;
    border-radius: 7px;
    border: none;
    cursor: pointer;
    font-family: Syne, sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
    background: transparent;
    transition: all 0.2s;
}

.tab.active {
    background: var(--bg-hover);
    color: var(--text);
    border: 1px solid var(--border-bright);
}

.input-area {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 20px;
}

.textarea {
    width: 100%;
    background: transparent;
    border: none;
    outline: none;
    padding: 20px;
    font-family: 'DM Mono', monospace;
    font-size: 13px;
    color: var(--text);
    resize: vertical;
    min-height: 240px;
    line-height: 1.7;
}

.textarea::placeholder {
    color: var(--text-dim);
}

.textarea-footer {
    padding: 8px 20px;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: flex-end;
}

.char-count {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: var(--text-muted);
}

.dropzone {
    position: relative;
    background: var(--bg-card);
    border: 2px dashed var(--border-bright);
    border-radius: 12px;
    padding: 60px 24px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 20px;
}

.dropzone:hover,
.dropzone.drag-active {
    border-color: var(--accent);
    background: var(--accent-glow);
}

.file-input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
    width: 100%;
    height: 100%;
}

.dropzone-icon {
    font-size: 32px;
    display: block;
    margin-bottom: 12px;
    color: var(--accent);
}

.dropzone-label {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 6px;
}

.dropzone-hint {
    font-size: 12px;
    color: var(--text-muted);
    font-family: 'DM Mono', monospace;
}

.error-msg {
    background: rgb(255 107 107 / 8%);
    border: 1px solid rgb(255 107 107 / 25%);
    color: var(--red);
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 13px;
    margin-bottom: 16px;
}

.submit-btn {
    width: 100%;
    padding: 16px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 10px;
    font-family: Syne, sans-serif;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 12px;
}

.submit-btn:hover:not(:disabled) {
    background: var(--accent-soft);
    transform: translateY(-1px);
    box-shadow: 0 8px 24px rgb(98 84 214 / 25%);
}

.submit-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
}

.loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
}

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

.progress-bar {
    height: 2px;
    background: var(--border);
    border-radius: 2px;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--blue));
    transition: width 0.4s ease;
}

/* ── Free notes mode ────────────────────────────────────────── */
.free-notes-area {
    margin-bottom: 20px;
}

.free-notes-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    background: rgb(124 109 255 / 6%);
    border-bottom: 1px solid var(--border);
}

.free-notes-badge {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    color: var(--accent);
    background: var(--accent-glow);
    border: 1px solid var(--accent-soft);
    padding: 2px 10px;
    border-radius: 20px;
}

.free-notes-hint {
    font-size: 12px;
    color: var(--text-muted);
}

.free-notes-textarea {
    min-height: 280px;
}

.free-notes-tip {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    color: var(--text-dim);
    font-style: italic;
}

/* ── Audio / Whisper section ─────────────────────────────────── */
.audio-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 8px;
}

.audio-dropzone {
    margin-bottom: 0;
}

.audio-filesize {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: var(--accent);
    margin-top: 4px;
}

.whisper-notice {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    background: rgb(91 196 255 / 6%);
    border: 1px solid rgb(91 196 255 / 15%);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.5;
}

.whisper-notice-icon {
    color: var(--blue);
    flex-shrink: 0;
    margin-top: 1px;
}

.whisper-notice strong {
    color: var(--text);
}

.transcribe-btn {
    width: 100%;
    padding: 14px;
    background: var(--bg-card);
    border: 1px solid var(--accent-soft);
    border-radius: 10px;
    font-family: Syne, sans-serif;
    font-size: 14px;
    font-weight: 700;
    color: var(--accent);
    cursor: pointer;
    transition: all 0.2s;
}

.transcribe-btn:hover {
    background: var(--accent-glow);
    border-color: var(--accent);
}

.transcribe-progress {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.transcribe-progress-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.spinner-text {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-muted);
}

.transcribe-pct {
    font-family: 'DM Mono', monospace;
    font-size: 12px;
    color: var(--accent);
}

.transcribe-success {
    padding: 12px 16px;
    background: rgb(61 255 160 / 6%);
    border: 1px solid rgb(61 255 160 / 20%);
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--green);
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.transcribe-meta {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: var(--text-muted);
    font-weight: 400;
}

/* ── Transitions ─────────────────────────────────────────────── */
.slide-up-enter-active,
.slide-up-leave-active {
    transition: all 0.4s ease;
}

.slide-up-enter-from {
    opacity: 0;
    transform: translateY(20px);
}

.slide-up-leave-to {
    opacity: 0;
    transform: translateY(-20px);
}
</style>
