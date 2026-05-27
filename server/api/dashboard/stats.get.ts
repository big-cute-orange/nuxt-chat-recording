import { defineEventHandler, type H3Event } from 'h3';
import { eq, desc } from 'drizzle-orm';
import { useDb } from '#server/utils/db';
import { meetings } from '#server/db/schema';

function initActivityDays(): Record<string, number> {
    const days: Record<string, number> = {};

    for (let i = 13; i >= 0; i--) {
        const d = new Date();

        d.setDate(d.getDate() - i);
        days[d.toISOString().slice(0, 10)] = 0;
    }

    return days;
}

export default defineEventHandler(async (event: H3Event) => {
    const session = await getUserSession(event);
    const userId = session?.user?.id;
    const days = initActivityDays();

    if (!userId) {
        return {
            totalMeetings: 0,
            totalActionItems: 0,
            totalDecisions: 0,
            totalParticipants: 0,
            actionsByOwner: [] as [string, number][],
            topTopics: [] as [string, number][],
            meetingTypes: [] as [string, number][],
            priorityBreakdown: [
                { label: 'High', count: 0, pct: 0, color: '#dc2626', bg: 'rgba(220,38,38,0.12)' },
                { label: 'Medium', count: 0, pct: 0, color: '#d97706', bg: 'rgba(217,119,6,0.12)' },
                { label: 'Low', count: 0, pct: 0, color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
            ],
            providerUsage: [] as [string, number][],
            activityData: Object.entries(days).map(([date, count]) => ({ date, count })),
            recentMeetings: [] as { id: string; date: string; meetingType: string; provider: string; charCount: number; mode: string }[],
        };
    }

    const db = useDb();
    const rows = await db
        .select({
            id: meetings.id,
            date: meetings.date,
            meetingType: meetings.meetingType,
            provider: meetings.provider,
            mode: meetings.mode,
            charCount: meetings.charCount,
            summary: meetings.summary,
        })
        .from(meetings)
        .where(eq(meetings.userId, userId))
        .orderBy(desc(meetings.createdAt));

    let totalActionItems = 0;
    let totalDecisions = 0;
    const participantSet = new Set<string>();
    const ownerCounts: Record<string, number> = {};
    const topicCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};
    const priorityCounts = { high: 0, medium: 0, low: 0 };
    const providerCounts: Record<string, number> = {};
    const rowCounts = new Map<string, { participantCount: number; actionItemCount: number; decisionCount: number }>();

    for (const row of rows) {
        providerCounts[row.provider] = (providerCounts[row.provider] ?? 0) + 1;
        typeCounts[row.meetingType] = (typeCounts[row.meetingType] ?? 0) + 1;

        const day = row.date.slice(0, 10);

        if (day in days) days[day] = (days[day] ?? 0) + 1;

        let summary: { actionItems?: unknown[]; decisions?: unknown[]; participants?: string[]; keyTopics?: string[] };

        try {
            summary = JSON.parse(row.summary);
        } catch {
            continue;
        }

        const items = Array.isArray(summary.actionItems) ? summary.actionItems : [];

        totalActionItems += items.length;

        for (const item of items as { owner?: string; priority?: string }[]) {
            const owner = item.owner || '未分配';

            ownerCounts[owner] = (ownerCounts[owner] ?? 0) + 1;

            const p = (item.priority ?? '').toLowerCase();

            if (p === 'high' || p === 'medium' || p === 'low') priorityCounts[p]++;
        }

        const decisions = Array.isArray(summary.decisions) ? summary.decisions : [];

        totalDecisions += decisions.length;

        const participants = Array.isArray(summary.participants) ? summary.participants : [];

        for (const p of participants) participantSet.add(p);

        rowCounts.set(row.id, { participantCount: participants.length, actionItemCount: items.length, decisionCount: decisions.length });

        const topics = Array.isArray(summary.keyTopics) ? summary.keyTopics : [];

        for (const t of topics) {
            const key = t.toLowerCase();

            topicCounts[key] = (topicCounts[key] ?? 0) + 1;
        }
    }

    const total = priorityCounts.high + priorityCounts.medium + priorityCounts.low || 1;

    return {
        totalMeetings: rows.length,
        totalActionItems,
        totalDecisions,
        totalParticipants: participantSet.size,
        actionsByOwner: Object.entries(ownerCounts).sort((a, b) => b[1] - a[1]).slice(0, 8),
        topTopics: Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 12),
        meetingTypes: Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 6),
        priorityBreakdown: [
            { label: 'High', count: priorityCounts.high, pct: Math.round((priorityCounts.high / total) * 100), color: '#dc2626', bg: 'rgba(220,38,38,0.12)' },
            { label: 'Medium', count: priorityCounts.medium, pct: Math.round((priorityCounts.medium / total) * 100), color: '#d97706', bg: 'rgba(217,119,6,0.12)' },
            { label: 'Low', count: priorityCounts.low, pct: Math.round((priorityCounts.low / total) * 100), color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
        ],
        providerUsage: Object.entries(providerCounts).sort((a, b) => b[1] - a[1]),
        activityData: Object.entries(days).map(([date, count]) => ({ date, count })),
        recentMeetings: rows.slice(0, 5).map(r => ({
            id: r.id,
            date: r.date,
            meetingType: r.meetingType,
            provider: r.provider,
            charCount: r.charCount,
            mode: r.mode,
            ...(rowCounts.get(r.id) ?? { participantCount: 0, actionItemCount: 0, decisionCount: 0 }),
        })),
    };
});
