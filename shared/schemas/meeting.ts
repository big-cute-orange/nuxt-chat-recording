import { z } from 'zod'

const ActionItemSchema = z.object({
    task: z.string(),
    owner: z.string(),
    deadline: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
})

const DecisionSchema = z.object({
    decision: z.string(),
    rationale: z.string(),
    madeBy: z.string(),
})

export const MeetingSummarySchema = z.object({
    summary: z.string(),
    actionItems: z.array(ActionItemSchema).default([]),
    decisions: z.array(DecisionSchema).default([]),
    participants: z.array(z.string()).default([]),
    meetingType: z.string().default(''),
    keyTopics: z.array(z.string()).default([]),
})

export type IMeetingSummary = z.infer<typeof MeetingSummarySchema>
