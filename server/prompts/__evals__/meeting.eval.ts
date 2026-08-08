import type { TSummaryInputType } from '../../services/summary/generateSummary'

export interface IMeetingEvalExpect {
    lang?: 'zh' | 'en'
    minActionItems?: number
    minDecisions?: number
    noEmptyTask?: boolean
    ownersInclude?: string[]
    priorityValid?: boolean
    schemaValid?: boolean
}

export interface IMeetingEvalCase {
    name: string
    inputType: TSummaryInputType
    input: string
    expect: IMeetingEvalExpect
}

export const cases: IMeetingEvalCase[] = [
    {
        name: '中文转录-基础抽取',
        inputType: 'transcript',
        input: '张伟：这周五前把登录 bug 修了。李娜负责这次评审。我们决定先上 v2，理由是客户催得急。',
        expect: {
            schemaValid: true,
            lang: 'zh',
            minActionItems: 1,
            ownersInclude: ['张伟'],
            minDecisions: 1,
            priorityValid: true,
            noEmptyTask: true,
        },
    },
    {
        name: '潦草笔记-优先级和负责人',
        inputType: 'free-notes',
        input: 'mtg w/ PM -> ship v2 asap. design TBD. bob owns api. low prio: cleanup logs',
        expect: {
            schemaValid: true,
            lang: 'en',
            minActionItems: 2,
            ownersInclude: ['bob'],
            priorityValid: true,
            noEmptyTask: true,
        },
    },
    {
        name: '超短输入-不强求行动项',
        inputType: 'transcript',
        input: '我们开了个会，讨论了下个季度的预算，最后没定下来。',
        expect: {
            schemaValid: true,
            lang: 'zh',
            priorityValid: true,
            noEmptyTask: true,
        },
    },
    {
        name: '无明确负责人-仍保持结构',
        inputType: 'transcript',
        input: '会议决定下周整理客户反馈，并在月底前输出改版方案。没有指定具体负责人，大家先各自补充材料。',
        expect: {
            schemaValid: true,
            lang: 'zh',
            minActionItems: 1,
            minDecisions: 1,
            priorityValid: true,
            noEmptyTask: true,
        },
    },
    {
        name: '英文站会-基础抽取',
        inputType: 'transcript',
        input: 'Alice: I will finish the onboarding flow by Friday. Ben: I am blocked on the billing API. We decided to postpone analytics until next sprint.',
        expect: {
            schemaValid: true,
            lang: 'en',
            minActionItems: 1,
            ownersInclude: ['Alice'],
            minDecisions: 1,
            priorityValid: true,
            noEmptyTask: true,
        },
    },
]
