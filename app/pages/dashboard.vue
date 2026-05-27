<script setup lang="ts">
import type { IHistoryEntry, TProvider, IMeetingSummary } from '~/types/index';

// ── 加载历史记录 ────────────────────────────────────────────────────────────────
const { history, total: historyTotal, load: historyLoad } = useHistory();

onMounted(() => historyLoad());

// ── 计算指标 ──────────────────────────────────────────────────────────────────
// historyTotal 反映服务器端完整数量，而非仅当前加载的页数
const totalMeetings = computed(() => historyTotal.value);
const totalActionItems = computed(() => history.value.reduce((sum: number, e: IHistoryEntry) => sum + e.summary.actionItems.length, 0));
const totalDecisions = computed(() => history.value.reduce((sum: number, e: IHistoryEntry) => sum + e.summary.decisions.length, 0));
const totalParticipants = computed(() => {
    const names = new Set<string>();

    history.value.forEach((e: IHistoryEntry) => e.summary.participants.forEach((p: string) => names.add(p)));

    return names.size;
});

// 按负责人统计行动项 — 按数量降序排列
const actionsByOwner = computed(() => {
    const counts: Record<string, number> = {};

    history.value.forEach((e: IHistoryEntry) =>
        e.summary.actionItems.forEach((item: IMeetingSummary['actionItems'][number]) => {
            const owner = item.owner || 'Unassigned';

            counts[owner] = (counts[owner] ?? 0) + 1;
        })
    );

    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
});

const maxOwnerCount = computed(() => actionsByOwner.value[0]?.[1] ?? 1);

// AI 提供商使用情况
const providerUsage = computed(() => {
    const counts: Record<string, number> = {};

    history.value.forEach((e: IHistoryEntry) => {
        counts[e.provider] = (counts[e.provider] ?? 0) + 1;
    });

    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
});

// 所有会议的高频话题
const topTopics = computed(() => {
    const counts: Record<string, number> = {};

    history.value.forEach((e: IHistoryEntry) =>
        e.summary.keyTopics.forEach((t: string) => {
            const key = t.toLowerCase();

            counts[key] = (counts[key] ?? 0) + 1;
        })
    );

    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12);
});

// 会议类型分布
const meetingTypes = computed(() => {
    const counts: Record<string, number> = {};

    history.value.forEach((e: IHistoryEntry) => {
        counts[e.meetingType] = (counts[e.meetingType] ?? 0) + 1;
    });

    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);
});

// 所有行动项的优先级分布
const priorityBreakdown = computed(() => {
    const counts = { high: 0, medium: 0, low: 0 };

    history.value.forEach((e: IHistoryEntry) =>
        e.summary.actionItems.forEach((item: IMeetingSummary['actionItems'][number]) => {
            if (item.priority in counts) counts[item.priority as keyof typeof counts]++;
        })
    );
    const total = counts.high + counts.medium + counts.low || 1;

    return [
        { label: 'High', count: counts.high, pct: Math.round((counts.high / total) * 100), color: '#dc2626', bg: 'rgba(220,38,38,0.12)' },
        {
            label: 'Medium',
            count: counts.medium,
            pct: Math.round((counts.medium / total) * 100),
            color: '#d97706',
            bg: 'rgba(217,119,6,0.12)',
        },
        { label: 'Low', count: counts.low, pct: Math.round((counts.low / total) * 100), color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
    ];
});

// 近 14 天每日会议数 — 用于迷你柱状图
const activityData = computed(() => {
    const days: Record<string, number> = {};

    // 初始化近 14 天的数据为 0
    for (let i = 13; i >= 0; i--) {
        const d = new Date();

        d.setDate(d.getDate() - i);
        days[d.toISOString().slice(0, 10)] = 0;
    }

    history.value.forEach((e: IHistoryEntry) => {
        const day = e.date.slice(0, 10);

        if (day in days) {
            days[day] = (days[day] ?? 0) + 1;
        }
    });

    return Object.entries(days).map(([date, count]) => ({ date, count }));
});

const maxActivity = computed(() => Math.max(...activityData.value.map((d: { count: number }) => d.count), 1));

// 最近 5 条会议记录
const recentMeetings = computed(() => history.value.slice(0, 5));

// ── 工具函数 ───────────────────────────────────────────────────────────────────
const providerLabels: Record<TProvider, string> = {
    gemini: 'Gemini',
    anthropic: 'Claude',
    openai: 'GPT-4o',
};

const providerColors: Record<TProvider, string> = {
    gemini: '#2563eb',
    anthropic: '#dc2626',
    openai: '#16a34a',
};

function formatRelative(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);

    if (mins < 60) {
        return `${mins}m ago`;
    }

    const hours = Math.floor(mins / 60);

    if (hours < 24) {
        return `${hours}h ago`;
    }

    return `${Math.floor(hours / 24)}d ago`;
}

// 活动图表柱高百分比（最高不超过列高 100%）
function barHeight(count: number) {
    return Math.max((count / maxActivity.value) * 100, count > 0 ? 8 : 0);
}

function getProviderColor(provider: string): string {
    return providerColors[provider as TProvider] ?? '#999';
}

function getProviderLabel(provider: string): string {
    return providerLabels[provider as TProvider] ?? provider;
}
</script>

<template>
    <div class="app">
        <!-- ── 顶部导航 ───────────────────────────────────────────────── -->
        <header class="header">
            <div class="header-inner">
                <NuxtLink to="/" class="logo">
                    <span class="logo-icon">◈</span>
                    <span class="logo-text">AI</span>
                    <span class="logo-tag">智能会议纪要助手</span>
                </NuxtLink>
                <nav class="nav">
                    <NuxtLink to="/" class="nav-link">← 分析</NuxtLink>
                    <!-- <NuxtLink to="/integrations" class="nav-link">Integrations</NuxtLink> -->
                    <span class="nav-active">数据看板</span>
                    <!-- <AuthButton /> -->
                </nav>
            </div>
        </header>

        <!-- ── 主体内容 ──────────────────────────────────────────────── -->
        <main class="main">
            <!-- 空状态 -->
            <div v-if="!totalMeetings" class="empty-state">
                <span class="empty-icon">◎</span>
                <h2 class="empty-title">暂无数据</h2>
                <p class="empty-sub">先完成一次会议分析，即可查看你的数据看板</p>
                <NuxtLink to="/" class="empty-cta">去分析一场会议 →</NuxtLink>
            </div>

            <template v-else>
                <div class="page-title">
                    <h1 class="title">数据看板</h1>
                    <p class="subtitle">{{ totalMeetings }} 场会议的关键洞察</p>
                </div>

                <!-- ── KPI 指标行 ────────────────────────────────────────── -->
                <div class="kpi-grid">
                    <div class="kpi-card">
                        <span class="kpi-value">{{ totalMeetings }}</span>
                        <span class="kpi-label">会议总数</span>
                    </div>
                    <div class="kpi-card">
                        <span class="kpi-value">{{ totalActionItems }}</span>
                        <span class="kpi-label">行动项总数</span>
                    </div>
                    <div class="kpi-card">
                        <span class="kpi-value">{{ totalDecisions }}</span>
                        <span class="kpi-label">决策总数</span>
                    </div>
                    <div class="kpi-card">
                        <span class="kpi-value">{{ totalParticipants }}</span>
                        <span class="kpi-label">参与人数</span>
                    </div>
                </div>

                <!-- ── 活动图表 + 优先级分布 ───────────────────────────────── -->
                <div class="row-2">
                    <!-- 活动迷你图 -->
                    <div class="card">
                        <div class="card-header">
                            <span class="card-icon">◎</span>
                            <h2 class="card-title">最近 14 天活动</h2>
                        </div>
                        <div class="sparkline">
                            <div
                                v-for="d in activityData"
                                :key="d.date"
                                class="spark-col"
                                :title="`${d.date}: ${d.count} meeting${d.count !== 1 ? 's' : ''}`"
                            >
                                <div class="spark-bar-wrap">
                                    <div class="spark-bar" :style="{ height: barHeight(d.count) + '%' }" :class="{ active: d.count > 0 }" />
                                </div>
                                <span class="spark-label">{{ d.date.slice(8) }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- 优先级分布 -->
                    <div class="card">
                        <div class="card-header">
                            <span class="card-icon">◉</span>
                            <h2 class="card-title">行动项优先级</h2>
                        </div>
                        <div class="priority-breakdown">
                            <div v-for="p in priorityBreakdown" :key="p.label" class="priority-row">
                                <span class="priority-name" :style="{ color: p.color }">{{ p.label }}</span>
                                <div class="priority-bar-track">
                                    <div class="priority-bar-fill" :style="{ width: p.pct + '%', background: p.color }" />
                                </div>
                                <span class="priority-stat">
                                    {{ p.count }}
                                    <span class="priority-pct">({{ p.pct }}%)</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ── 按负责人统计行动项 + 提供商使用情况 ────────────────── -->
                <div class="row-2">
                    <!-- 按负责人统计行动项 -->
                    <div v-if="actionsByOwner.length" class="card">
                        <div class="card-header">
                            <span class="card-icon">👤</span>
                            <h2 class="card-title">责任人行动项</h2>
                        </div>
                        <div class="owner-list">
                            <div v-for="[owner, count] in actionsByOwner" :key="owner" class="owner-row">
                                <span class="owner-name">{{ owner }}</span>
                                <div class="owner-bar-track">
                                    <div class="owner-bar-fill" :style="{ width: (count / maxOwnerCount) * 100 + '%' }" />
                                </div>
                                <span class="owner-count">{{ count }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- 提供商使用情况 + 会议类型 -->
                    <div style="display: flex; flex-direction: column; gap: 16px">
                        <div v-if="providerUsage.length" class="card">
                            <div class="card-header">
                                <span class="card-icon">◈</span>
                                <h2 class="card-title">模型使用情况</h2>
                            </div>
                            <div class="provider-usage">
                                <div v-for="[prov, count] in providerUsage" :key="prov" class="provider-row">
                                    <span class="provider-dot" :style="{ background: getProviderColor(prov) }" />
                                    <span class="provider-name-label">{{ getProviderLabel(prov) }}</span>
                                    <span class="provider-count-label">{{ count }} meeting{{ count !== 1 ? 's' : '' }}</span>
                                    <div class="provider-bar-track">
                                        <div
                                            class="provider-bar-fill"
                                            :style="{
                                                width: (count / totalMeetings) * 100 + '%',
                                                background: getProviderColor(prov),
                                            }"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div v-if="meetingTypes.length" class="card">
                            <div class="card-header">
                                <span class="card-icon">≡</span>
                                <h2 class="card-title">会议类型</h2>
                            </div>
                            <div class="meeting-types">
                                <div v-for="[type, count] in meetingTypes" :key="type" class="meeting-type-row">
                                    <span class="meeting-type-name">{{ type }}</span>
                                    <span class="meeting-type-count">{{ count }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ── 高频话题 ─────────────────────────────────────────── -->
                <div v-if="topTopics.length" class="card">
                    <div class="card-header">
                        <span class="card-icon">◷</span>
                        <h2 class="card-title">全部会议热门议题</h2>
                    </div>
                    <div class="topics-cloud">
                        <span
                            v-for="[topic, count] in topTopics"
                            :key="topic"
                            class="topic-chip"
                            :style="{ fontSize: Math.min(10 + count * 2, 18) + 'px', opacity: 0.5 + count * 0.1 }"
                        >
                            {{ topic }}
                            <span class="topic-count">{{ count }}</span>
                        </span>
                    </div>
                </div>

                <!-- ── 最近会议 ─────────────────────────────────────────── -->
                <div class="card">
                    <div class="card-header">
                        <span class="card-icon">◷</span>
                        <h2 class="card-title">最近会议</h2>
                        <NuxtLink to="/" class="card-link">查看全部 →</NuxtLink>
                    </div>
                    <div class="recent-list">
                        <div v-for="entry in recentMeetings" :key="entry.id" class="recent-item">
                            <div class="recent-main">
                                <span class="recent-type">{{ entry.meetingType }}</span>
                                <span class="recent-date">{{ formatRelative(entry.date) }}</span>
                            </div>
                            <div class="recent-meta">
                                <span class="recent-stat">{{ entry.summary.participants.length }} 参与人</span>
                                <span class="recent-stat">{{ entry.summary.actionItems.length }} 行动项</span>
                                <span class="recent-stat">{{ entry.summary.decisions.length }} 关键决策</span>
                                <span class="recent-provider" :style="{ color: getProviderColor(entry.provider) }">
                                    {{ getProviderLabel(entry.provider) }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
        </main>
    </div>
</template>

<style scoped>
.app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}

/* ── 顶部导航 ────────────────────────────────────────────────── */
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
    padding: 16px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.logo {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    color: var(--text);
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
}

.nav {
    display: flex;
    align-items: center;
    gap: 16px;
}

.nav-link {
    font-family: Syne, sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
    text-decoration: none;
    transition: color 0.2s;
}

.nav-link:hover {
    color: var(--text);
}

.nav-active {
    font-family: Syne, sans-serif;
    font-size: 13px;
    font-weight: 700;
    color: var(--accent);
}

/* ── 主体内容 ────────────────────────────────────────────────── */
.main {
    flex: 1;
    max-width: 1100px;
    margin: 0 auto;
    padding: 48px 24px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.page-title {
    margin-bottom: 8px;
}

.title {
    font-size: 32px;
    font-weight: 800;
    letter-spacing: -1px;
    margin-bottom: 4px;
}

.subtitle {
    font-size: 14px;
    color: var(--text-muted);
    font-family: 'DM Mono', monospace;
}

/* ── 空状态 ──────────────────────────────────────────────────── */
.empty-state {
    text-align: center;
    padding: 80px 24px;
}

.empty-icon {
    font-size: 48px;
    display: block;
    color: var(--text-dim);
    margin-bottom: 20px;
}

.empty-title {
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 10px;
}

.empty-sub {
    font-size: 14px;
    color: var(--text-muted);
    margin-bottom: 28px;
}

.empty-cta {
    display: inline-block;
    padding: 12px 24px;
    background: var(--accent);
    color: white;
    border-radius: 10px;
    text-decoration: none;
    font-family: Syne, sans-serif;
    font-size: 14px;
    font-weight: 700;
    transition: all 0.2s;
}

.empty-cta:hover {
    background: var(--accent-soft);
    transform: translateY(-1px);
    box-shadow: 0 8px 24px rgb(98 84 214 / 25%);
}

/* ── KPI 指标网格 ─────────────────────────────────────────────── */
.kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
}

@media (width <= 600px) {
    .kpi-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

.kpi-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 24px 20px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.kpi-value {
    font-size: 40px;
    font-weight: 800;
    letter-spacing: -2px;
    line-height: 1;
    background: linear-gradient(135deg, var(--text) 0%, var(--text-muted) 100%);
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.kpi-label {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
}

/* ── 2-col layout ────────────────────────────────────────────── */
.row-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
}

@media (width <= 700px) {
    .row-2 {
        grid-template-columns: 1fr;
    }
}

/* ── 卡片 ────────────────────────────────────────────────────── */
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
    font-size: 15px;
    font-weight: 700;
    flex: 1;
    letter-spacing: -0.3px;
}

.card-link {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: var(--accent);
    text-decoration: none;
}

.card-link:hover {
    text-decoration: underline;
}

/* ── 活动迷你图 ──────────────────────────────────────────────── */
.sparkline {
    display: flex;
    gap: 4px;
    align-items: flex-end;
    height: 80px;
}

.spark-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    height: 100%;
}

.spark-bar-wrap {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: flex-end;
}

.spark-bar {
    width: 100%;
    border-radius: 3px 3px 0 0;
    background: var(--border-bright);
    min-height: 2px;
    transition: height 0.4s ease;
}

.spark-bar.active {
    background: var(--accent);
}

.spark-label {
    font-family: 'DM Mono', monospace;
    font-size: 9px;
    color: var(--text-dim);
}

/* ── 优先级分布 ──────────────────────────────────────────────── */
.priority-breakdown {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.priority-row {
    display: flex;
    align-items: center;
    gap: 12px;
}

.priority-name {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    width: 50px;
    flex-shrink: 0;
}

.priority-bar-track {
    flex: 1;
    height: 6px;
    background: var(--bg-hover);
    border-radius: 3px;
    overflow: hidden;
}

.priority-bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.6s ease;
    opacity: 0.8;
}

.priority-stat {
    font-family: 'DM Mono', monospace;
    font-size: 12px;
    color: var(--text);
    width: 60px;
    text-align: right;
    flex-shrink: 0;
}

.priority-pct {
    color: var(--text-muted);
    font-size: 10px;
}

/* ── 按负责人统计行动项 ───────────────────────────────────────── */
.owner-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.owner-row {
    display: flex;
    align-items: center;
    gap: 12px;
}

.owner-name {
    font-size: 13px;
    font-weight: 600;
    width: 110px;
    flex-shrink: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.owner-bar-track {
    flex: 1;
    height: 6px;
    background: var(--bg-hover);
    border-radius: 3px;
    overflow: hidden;
}

.owner-bar-fill {
    height: 100%;
    border-radius: 3px;
    background: var(--accent);
    opacity: 0.7;
    transition: width 0.6s ease;
}

.owner-count {
    font-family: 'DM Mono', monospace;
    font-size: 12px;
    color: var(--text-muted);
    width: 24px;
    text-align: right;
    flex-shrink: 0;
}

/* ── 提供商使用情况 ───────────────────────────────────────────── */
.provider-usage {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.provider-row {
    display: flex;
    align-items: center;
    gap: 10px;
}

.provider-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
}

.provider-name-label {
    font-size: 13px;
    font-weight: 600;
    width: 60px;
    flex-shrink: 0;
}

.provider-count-label {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: var(--text-muted);
    width: 70px;
    flex-shrink: 0;
}

.provider-bar-track {
    flex: 1;
    height: 6px;
    background: var(--bg-hover);
    border-radius: 3px;
    overflow: hidden;
}

.provider-bar-fill {
    height: 100%;
    border-radius: 3px;
    opacity: 0.7;
    transition: width 0.6s ease;
}

/* ── 会议类型 ────────────────────────────────────────────────── */
.meeting-types {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.meeting-type-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
}

.meeting-type-name {
    font-size: 13px;
    font-weight: 600;
}

.meeting-type-count {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: var(--text-muted);
    background: var(--bg-hover);
    border: 1px solid var(--border-bright);
    padding: 2px 8px;
    border-radius: 10px;
}

/* ── 云话题词 ────────────────────────────────────────────────── */
.topics-cloud {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: baseline;
}

.topic-chip {
    background: var(--accent-glow);
    border: 1px solid rgb(124 109 255 / 20%);
    color: var(--accent);
    padding: 4px 12px;
    border-radius: 20px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.topic-count {
    font-family: 'DM Mono', monospace;
    font-size: 9px;
    opacity: 0.6;
}

/* ── 最近会议 ────────────────────────────────────────────────── */
.recent-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.recent-item {
    padding: 14px 16px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    transition: border-color 0.2s;
}

.recent-item:hover {
    border-color: var(--border-bright);
}

.recent-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
}

.recent-type {
    font-size: 14px;
    font-weight: 600;
}

.recent-date {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: var(--text-muted);
}

.recent-meta {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
}

.recent-stat {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: var(--text-muted);
}

.recent-provider {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    margin-left: auto;
}

/* ── 底部 ────────────────────────────────────────────────────── */
.footer {
    border-top: 1px solid var(--border);
    text-align: center;
    padding: 20px;
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: var(--text-dim);
    letter-spacing: 0.05em;
}
</style>
