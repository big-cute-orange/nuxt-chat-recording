// POST /api/integrations/notion
// Creates pages in a Notion database from meeting action items

import { defineEventHandler, readBody, createError, type H3Event } from 'h3'
import type { IActionItem } from '~/types'
import { useDb } from '#server/utils/db'
import { actionItems as actionItemsTable } from '#server/db/schema'
import { eq, and, isNull } from 'drizzle-orm'

type TNotionPropertyValue =
    | { title: Array<{ text: { content: string } }> }
    | { select: { name: string; color?: string } }
    | { multi_select: Array<{ name: string }> }
    | { rich_text: Array<{ text: { content: string } }> }
    | { date: { start: string } }

interface INotionPagePayload {
    parent: { database_id: string }
    properties: Record<string, TNotionPropertyValue>
    children: Array<{
        object: 'block'
        type: 'paragraph'
        paragraph: {
            rich_text: Array<{
                type: 'text'
                text: { content: string }
            }>
        }
    }>
}

const PRIORITY_COLORS: Record<string, string> = {
    high: 'red',
    medium: 'yellow',
    low: 'green',
}

export default defineEventHandler(async (event: H3Event) => {
    const db = useDb()
    const session = await getUserSession(event)
    const userId = session?.user?.id || null
    const body = await readBody(event)
    const { integrationToken, databaseId, actionItems, meetingType, meetingId } = body

    if (!integrationToken || !databaseId) {
        throw createError({ statusCode: 400, message: 'Missing Notion configuration (integrationToken, databaseId).' })
    }

    if (!actionItems?.length) {
        throw createError({ statusCode: 400, message: 'No action items to send.' })
    }

    const headers = {
        Authorization: `Bearer ${integrationToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
    }

    // First, introspect the database to find available properties
    const dbRes = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, { headers })

    if (!dbRes.ok) {
        const err = await dbRes.json()

        throw createError({
            statusCode: 400,
            message: err.message ?? 'Could not access Notion database. Check your token and database ID.',
        })
    }

    const notionDb = await dbRes.json()
    const props = notionDb.properties as Record<string, { id: string; type: string }>

    // Detect common property names across different database schemas
    const findProp = (...names: string[]) => names.find((n) => props[n]) ?? null

    const titleProp =
        findProp('Name', 'Task', 'Title', 'Issue', 'Todo') ?? Object.keys(props).find((k) => props[k]?.type === 'title') ?? 'Name'
    const assigneeProp = findProp('Assignee', 'Owner', 'Assigned to', 'Person')
    const priorityProp = findProp('Priority')
    const tagsProp = findProp('Tags', 'Label', 'Labels')
    const deadlineProp = findProp('Deadline', 'Due Date', 'Due', 'Date')

    const results: { task: string; url: string | null; error: string | null }[] = []

    for (const item of actionItems as IActionItem[]) {
        try {
            // Build properties dynamically based on what the database has
            const properties: Record<string, TNotionPropertyValue> = {
                [titleProp]: { title: [{ text: { content: item.task } }] },
            }

            if (priorityProp && props[priorityProp]?.type === 'select') {
                properties[priorityProp] = {
                    select: { name: item.priority.charAt(0).toUpperCase() + item.priority.slice(1), color: PRIORITY_COLORS[item.priority] },
                }
            }

            if (tagsProp && props[tagsProp]?.type === 'multi_select') {
                properties[tagsProp] = {
                    multi_select: [{ name: `MinutAI — ${meetingType ?? 'Meeting'}` }],
                }
            }

            // Map owner to assignee property
            if (assigneeProp && item.owner) {
                const propType = props[assigneeProp]?.type

                if (propType === 'rich_text') {
                    properties[assigneeProp] = {
                        rich_text: [{ text: { content: item.owner } }],
                    }
                } else if (propType === 'people') {
                    // For people type, we can only set by name if the person exists in the workspace
                    // Since we don't have the person ID, we'll fall back to rich_text or skip
                    // Note: Notion API requires person ID for people type, so this might not work
                    // We'll add it to the description instead
                }
            }

            // Map deadline to date property
            if (deadlineProp && item.deadline && props[deadlineProp]?.type === 'date') {
                // Try to parse the deadline into ISO format
                try {
                    const dateStr = item.deadline.trim()
                    // If it's already in ISO format or a valid date string
                    const date = new Date(dateStr)

                    if (!isNaN(date.getTime())) {
                        properties[deadlineProp] = {
                            date: { start: date.toISOString().split('T')[0]! },
                        }
                    }
                } catch {
                    console.warn('[notion] Could not parse deadline:', item.deadline)
                }
            }

            // Build description content for the page body
            const descriptionParts: string[] = []

            if (item.owner && (!assigneeProp || props[assigneeProp]?.type === 'people')) {
                descriptionParts.push(`负责人: ${item.owner}`)
            }

            if (item.deadline && (!deadlineProp || props[deadlineProp]?.type !== 'date')) {
                descriptionParts.push(`截止日期: ${item.deadline}`)
            }
            descriptionParts.push(`由 MeetNote 从${meetingType ?? '会议'}中创建`)

            const payload: INotionPagePayload = {
                parent: { database_id: databaseId },
                properties,
                children: [
                    {
                        object: 'block',
                        type: 'paragraph',
                        paragraph: {
                            rich_text: [
                                {
                                    type: 'text',
                                    text: {
                                        content: descriptionParts.join('\n'),
                                    },
                                },
                            ],
                        },
                    },
                ],
            }

            const res = await fetch('https://api.notion.com/v1/pages', {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
            })

            const data = await res.json()

            if (!res.ok) {
                results.push({ task: item.task, url: null, error: data.message ?? `HTTP ${res.status}` })
            } else {
                results.push({ task: item.task, url: data.url, error: null })

                if (meetingId) {
                    try {
                        const now = new Date().toISOString()
                        const existing = await db
                            .select({ id: actionItemsTable.id })
                            .from(actionItemsTable)
                            .where(
                                and(
                                    eq(actionItemsTable.meetingId, meetingId),
                                    eq(actionItemsTable.title, item.task),
                                    userId ? eq(actionItemsTable.userId, userId) : isNull(actionItemsTable.userId)
                                )
                            )
                            .limit(1)

                        if (existing.length) {
                            await db
                                .update(actionItemsTable)
                                .set({ externalService: 'notion', externalUrl: data.url ?? null, updatedAt: now })
                                .where(eq(actionItemsTable.id, existing[0]!.id))
                        } else {
                            await db.insert(actionItemsTable).values({
                                id: crypto.randomUUID(),
                                meetingId,
                                userId,
                                title: item.task,
                                assignee: item.owner ?? null,
                                dueDate: item.deadline ?? null,
                                priority: (item.priority?.toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH') ?? 'MEDIUM',
                                externalService: 'notion',
                                externalUrl: data.url ?? null,
                                createdAt: now,
                                updatedAt: now,
                            })
                        }
                    } catch (dbErr) {
                        console.error('[notion] DB persist failed for item:', item.task, dbErr)
                    }
                } else {
                    console.warn('[notion] No meetingId provided, skipping DB persist')
                }
            }
        } catch (err: unknown) {
            results.push({ task: item.task, url: null, error: (err as Error).message })
        }
    }

    return { results }
})
