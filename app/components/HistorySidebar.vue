<script setup lang="ts">
import type { IHistoryEntry } from '~/types/index';

const props = defineProps<{
    history: IHistoryEntry[];
    activeHistoryId: string | null;
    historyTotal: number;
    historyHasMore: boolean;
    historyLoading: boolean;
    providerName: (provider: IHistoryEntry['provider']) => string;
    formatDate: (date: string, withTime?: boolean) => string;
}>();

const emit = defineEmits<{
    clear: [];
    loadMore: [];
    openEntry: [entry: IHistoryEntry];
    deleteEntry: [id: string];
}>();

const open = ref(false);

function closeSidebar() {
    open.value = false;
}

function handleOpenEntry(entry: IHistoryEntry) {
    emit('openEntry', entry);
    closeSidebar();
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
                        <h2 class="sidebar-title">历史记录</h2>
                        <div class="sidebar-actions">
                            <button v-if="props.history.length" type="button" class="sidebar-clear" @click="emit('clear')">清空全部</button>
                            <button type="button" class="sidebar-close" @click="closeSidebar">✕</button>
                        </div>
                    </div>

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
                                <button type="button" class="history-delete" @click.stop="emit('deleteEntry', entry.id)">✕</button>
                            </div>
                            <div class="history-item-meta">
                                <span class="history-date">{{ props.formatDate(entry.date, true) }}</span>
                                <span class="history-provider">{{ props.providerName(entry.provider) }}</span>
                            </div>
                            <div class="history-item-stats">
                                <span>{{ entry.summary?.participants?.length ?? 0 }} 参与人</span>
                                <span>{{ entry.summary?.actionItems?.length ?? 0 }} 行动项</span>
                                <span>{{ entry.charCount.toLocaleString() }} 字符</span>
                            </div>
                        </li>
                    </ul>

                    <div v-if="props.historyHasMore" class="sidebar-load-more">
                        <button type="button" class="load-more-btn" :disabled="props.historyLoading" @click="emit('loadMore')">
                            {{ props.historyLoading ? '加载中...' : '加载更多' }}
                        </button>
                    </div>
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
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
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
    padding: 20px 20px 16px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
}

.sidebar-title {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: -0.3px;
}

.sidebar-actions {
    display: flex;
    gap: 8px;
    align-items: center;
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
    flex-shrink: 0;
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
