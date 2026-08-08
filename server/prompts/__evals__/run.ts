import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { generateSummary, validateSummaryProvider } from '../../services/summary/generateSummary'
import type { TProvider } from '../../utils/ai'
import { version as promptVersion } from '../index'
import { cases, type IMeetingEvalCase } from './meeting.eval'
import { runDeterministicAssertions } from './assertions'

const DEFAULT_PROVIDER: TProvider = 'deepseek'
const DEFAULT_THRESHOLD = 0.95

function print(message = ''): void {
    process.stdout.write(`${message}\n`)
}

function loadDotenv(): void {
    const envPath = resolve(process.cwd(), '.env')

    if (!existsSync(envPath)) return

    const lines = readFileSync(envPath, 'utf8').split(/\r?\n/)

    for (const line of lines) {
        const trimmed = line.trim()

        if (!trimmed || trimmed.startsWith('#')) continue

        const separatorIndex = trimmed.indexOf('=')

        if (separatorIndex === -1) continue

        const key = trimmed.slice(0, separatorIndex).trim()
        const rawValue = trimmed.slice(separatorIndex + 1).trim()

        if (!key) continue

        if (process.env[key]) continue

        process.env[key] = rawValue.replace(/^['"]|['"]$/g, '')
    }
}

function buildEvalConfig(): Record<string, string> {
    return {
        deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
        qwenApiKey: process.env.QWEN_API_KEY || '',
        dobaoApiKey: process.env.DOBAO_API_KEY || '',
        dobaoModelId: process.env.DOBAO_MODEL_ID || '',
    }
}

function getProvider(): TProvider {
    const provider = process.env.EVAL_PROVIDER || DEFAULT_PROVIDER

    if (!validateSummaryProvider(provider)) {
        throw new Error(`Invalid EVAL_PROVIDER "${provider}". Expected deepseek, qwen, or doubao.`)
    }

    return provider
}

function getThreshold(): number {
    const raw = process.env.EVAL_THRESHOLD

    if (!raw) return DEFAULT_THRESHOLD

    const parsed = Number(raw)

    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) {
        throw new Error(`Invalid EVAL_THRESHOLD "${raw}". Expected a number between 0 and 1.`)
    }

    return parsed
}

function countExpectedAssertions(expect: IMeetingEvalCase['expect']): number {
    let count = 0

    if (typeof expect.schemaValid === 'boolean') {
        count++
    }

    if (expect.lang) {
        count++
    }

    if (typeof expect.minActionItems === 'number') {
        count++
    }

    if (typeof expect.minDecisions === 'number') {
        count++
    }

    if (expect.ownersInclude?.length) {
        count += expect.ownersInclude.length
    }

    if (typeof expect.priorityValid === 'boolean') {
        count++
    }

    if (typeof expect.noEmptyTask === 'boolean') {
        count++
    }

    return Math.max(count, 1)
}

async function main() {
    loadDotenv()

    const provider = getProvider()
    const threshold = getThreshold()
    const config = buildEvalConfig()

    print(`Prompt eval: prompt=${promptVersion}, provider=${provider}, threshold=${threshold}`)

    let passed = 0
    let total = 0

    for (const testCase of cases) {
        print(`\n[case] ${testCase.name}`)

        try {
            const result = await generateSummary({
                config,
                inputType: testCase.inputType,
                provider,
                text: testCase.input,
                temperature: 0,
            })

            const assertions = runDeterministicAssertions(testCase, result.data, result.validation.passed)

            for (const assertion of assertions) {
                total++
                if (assertion.passed) passed++

                const mark = assertion.passed ? 'PASS' : 'FAIL'

                print(`  ${mark} ${assertion.name} - ${assertion.message}`)
            }

            if (!result.validation.passed && result.validation.errors) {
                print(`  validationErrors: ${result.validation.errors}`)
            }
        } catch (error) {
            const expectedCount = countExpectedAssertions(testCase.expect)

            total += expectedCount
            const message = error instanceof Error ? error.message : 'Unknown error'

            print(`  FAIL modelCall (${expectedCount} assertions skipped) - ${message}`)
        }
    }

    const rate = total === 0 ? 0 : passed / total
    const percent = (rate * 100).toFixed(1)
    const thresholdPercent = (threshold * 100).toFixed(1)

    print(`\nResult: ${passed}/${total} assertions passed (${percent}%). Required: ${thresholdPercent}%.`)

    if (rate < threshold) {
        process.exitCode = 1
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
})
