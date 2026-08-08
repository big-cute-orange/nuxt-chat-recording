import { version as promptVersion, transcriptPrompt, freeNotesPrompt } from '../../prompts/index'
import { buildProviderConfig, type TProvider } from '../../utils/ai'
import { MeetingSummarySchema, type IMeetingSummary } from '../../../shared/schemas/meeting'

export type TSummaryInputType = 'transcript' | 'free-notes'

export interface ISummaryValidation {
    passed: boolean
    errors: string | null
}

export interface ISummaryParseResult {
    cleaned: string
    data: IMeetingSummary | null
    validation: ISummaryValidation
}

export interface IGenerateSummaryOptions {
    config: Record<string, string>
    inputType: TSummaryInputType
    provider: TProvider
    text: string
    temperature?: number
}

export interface IGenerateSummaryResult extends ISummaryParseResult {
    promptVersion: string
    raw: string
}

export function getSummarySystemPrompt(inputType: TSummaryInputType): string {
    return inputType === 'free-notes' ? freeNotesPrompt : transcriptPrompt
}

export function buildSummaryUserMessage(inputType: TSummaryInputType, text: string): string {
    return inputType === 'free-notes'
        ? `Please structure these raw meeting notes:\n\n${text}`
        : `Please analyze this meeting transcript:\n\n${text}`
}

export function cleanSummaryOutput(raw: string): string {
    return raw
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
}

export function parseSummaryOutput(raw: string): ISummaryParseResult {
    const cleaned = cleanSummaryOutput(raw)

    try {
        const parsed = MeetingSummarySchema.safeParse(JSON.parse(cleaned))

        return {
            cleaned,
            data: parsed.success ? parsed.data : null,
            validation: {
                passed: parsed.success,
                errors: parsed.success ? null : JSON.stringify(parsed.error.flatten()),
            },
        }
    } catch {
        return {
            cleaned,
            data: null,
            validation: {
                passed: false,
                errors: JSON.stringify({ message: 'Invalid JSON returned by AI' }),
            },
        }
    }
}

export function validateSummaryProvider(provider: string): provider is TProvider {
    return ['deepseek', 'qwen', 'doubao'].includes(provider)
}

export async function generateSummary(options: IGenerateSummaryOptions): Promise<IGenerateSummaryResult> {
    const { client, model } = buildProviderConfig(options.provider, options.config)

    const response = await client.chat.completions.create({
        model,
        max_tokens: 2048,
        temperature: options.temperature ?? 0,
        messages: [
            { role: 'system', content: getSummarySystemPrompt(options.inputType) },
            { role: 'user', content: buildSummaryUserMessage(options.inputType, options.text) },
        ],
    })

    const raw = response.choices[0]?.message.content ?? ''
    const parsed = parseSummaryOutput(raw)

    return {
        promptVersion,
        raw,
        ...parsed,
    }
}
