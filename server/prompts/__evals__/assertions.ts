import type { IMeetingSummary } from '../../../shared/schemas/meeting'
import type { IMeetingEvalCase } from './meeting.eval'

export interface IAssertionResult {
    name: string
    passed: boolean
    message: string
}

const VALID_PRIORITIES = new Set(['high', 'medium', 'low'])

function normalizeText(value: string): string {
    return value.trim().toLowerCase()
}

function countChineseChars(value: string): number {
    return Array.from(value).filter((char) => /[\u4e00-\u9fff]/.test(char)).length
}

function countLatinLetters(value: string): number {
    return Array.from(value).filter((char) => /[a-z]/i.test(char)).length
}

function detectLanguage(value: string): 'zh' | 'en' | 'unknown' {
    const zh = countChineseChars(value)
    const en = countLatinLetters(value)
    const total = zh + en

    if (total === 0) return 'unknown'

    return zh / total >= 0.3 ? 'zh' : 'en'
}

function ownerMatches(actual: string, expected: string): boolean {
    const actualText = normalizeText(actual)
    const expectedText = normalizeText(expected)

    return actualText.includes(expectedText) || expectedText.includes(actualText)
}

export function runDeterministicAssertions(
    testCase: IMeetingEvalCase,
    summary: IMeetingSummary | null,
    validationPassed: boolean,
): IAssertionResult[] {
    const results: IAssertionResult[] = []
    const expect = testCase.expect

    if (typeof expect.schemaValid === 'boolean') {
        results.push({
            name: 'schemaValid',
            passed: validationPassed === expect.schemaValid,
            message: validationPassed ? 'Schema validation passed.' : 'Schema validation failed.',
        })
    }

    if (!summary) {
        return results
    }

    if (expect.lang) {
        const actual = detectLanguage(summary.summary)

        results.push({
            name: 'lang',
            passed: actual === expect.lang,
            message: `Expected ${expect.lang}, got ${actual}.`,
        })
    }

    if (typeof expect.minActionItems === 'number') {
        results.push({
            name: 'minActionItems',
            passed: summary.actionItems.length >= expect.minActionItems,
            message: `Expected at least ${expect.minActionItems}, got ${summary.actionItems.length}.`,
        })
    }

    if (typeof expect.minDecisions === 'number') {
        results.push({
            name: 'minDecisions',
            passed: summary.decisions.length >= expect.minDecisions,
            message: `Expected at least ${expect.minDecisions}, got ${summary.decisions.length}.`,
        })
    }

    if (expect.ownersInclude?.length) {
        const owners = summary.actionItems.map((item) => item.owner)

        for (const expectedOwner of expect.ownersInclude) {
            results.push({
                name: `ownersInclude:${expectedOwner}`,
                passed: owners.some((owner) => ownerMatches(owner, expectedOwner)),
                message: `Expected owner "${expectedOwner}" in [${owners.join(', ')}].`,
            })
        }
    }

    if (typeof expect.priorityValid === 'boolean') {
        const invalid = summary.actionItems.filter((item) => !VALID_PRIORITIES.has(item.priority))

        results.push({
            name: 'priorityValid',
            passed: (invalid.length === 0) === expect.priorityValid,
            message: invalid.length === 0 ? 'All priorities are valid.' : `Invalid priorities: ${invalid.map((item) => item.priority).join(', ')}.`,
        })
    }

    if (typeof expect.noEmptyTask === 'boolean') {
        const emptyTasks = summary.actionItems.filter((item) => item.task.trim().length === 0 || ['n/a', 'none', '无'].includes(normalizeText(item.task)))

        results.push({
            name: 'noEmptyTask',
            passed: (emptyTasks.length === 0) === expect.noEmptyTask,
            message: emptyTasks.length === 0 ? 'No empty tasks.' : `Found ${emptyTasks.length} empty task(s).`,
        })
    }

    return results
}
