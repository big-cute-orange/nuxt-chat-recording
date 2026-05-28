import OpenAI from 'openai'
import { defineEventHandler, readBody, createError, type H3Event } from 'h3'
import { judgeResults } from '../db/schema'

type TProvider = 'deepseek' | 'qwen' | 'doubao'

const ALL_PROVIDERS: TProvider[] = ['deepseek', 'qwen', 'doubao']

export interface IJudgeScores {
    completeness: number
    accuracy: number
    actionability: number
    conciseness: number
    overall: number
}

export interface IJudgeResponse {
    winner: 'model_a' | 'model_b' | 'tie'
    scores: {
        model_a: IJudgeScores
        model_b: IJudgeScores
    }
    reason: string
    judgeProvider: TProvider
}

function buildJudgeClient(provider: TProvider, config: Record<string, string>): { client: OpenAI; model: string } | null {
    switch (provider) {
        case 'deepseek':
            if (!config.deepseekApiKey) return null
            return {
                client: new OpenAI({ apiKey: config.deepseekApiKey, baseURL: 'https://api.deepseek.com/v1' }),
                model: 'deepseek-chat',
            }
        case 'qwen':
            if (!config.qwenApiKey) return null
            return {
                client: new OpenAI({ apiKey: config.qwenApiKey, baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1' }),
                model: 'qwen-plus',
            }
        case 'doubao':
            if (!config.dobaoApiKey || !config.dobaoModelId) return null
            return {
                client: new OpenAI({ apiKey: config.dobaoApiKey, baseURL: 'https://ark.cn-beijing.volces.com/api/v3', timeout: 60_000 }),
                model: config.dobaoModelId,
            }
    }
}

function buildJudgePrompt(transcript: string, outputA: string, outputB: string): string {
    return `You are an expert evaluator of AI-generated meeting summaries. Your task is to compare two meeting summaries and score them objectively.

## Original Meeting Transcript
${transcript}

## Model A Output
${outputA}

## Model B Output
${outputB}

## Evaluation Criteria

Score each model on a scale of 1-10 for each dimension:

1. **completeness** (1-10): Does the summary cover all important content?
   - Did it capture core discussions?
   - Are all key action items included?
   - Are decisions and participants identified?

2. **accuracy** (1-10): Is the summary faithful to the transcript?
   - No hallucinations or fabricated information
   - No misinterpretation of meeting content
   - Facts match what was actually said

3. **actionability** (1-10): Are action items specific and executable?
   - Good: "张三在下周五前完成登录页 OAuth 重构"
   - Bad: "优化登录功能"
   - Check: clear task, named owner, time information, executable

4. **conciseness** (1-10): Is the content clear and non-redundant?
   - No unnecessary repetition
   - Information is well-organized
   - Not overly verbose

## Instructions
- Be objective and base scores strictly on the transcript content
- Compute overall as: (completeness * 0.3 + accuracy * 0.3 + actionability * 0.25 + conciseness * 0.15)
- Round overall to 1 decimal place
- winner is "model_a", "model_b", or "tie" (tie only if overall scores differ by less than 0.3)
- Write the "reason" field in Chinese, 3-5 sentences covering: which model won and why overall, specific strengths/weaknesses per dimension (completeness, accuracy, actionability, conciseness), and any notable differences in how each model handled the content

Respond with ONLY valid JSON, no markdown, no explanation outside the JSON:
{
  "winner": "model_a",
  "scores": {
    "model_a": {
      "completeness": 9,
      "accuracy": 8,
      "actionability": 9,
      "conciseness": 8,
      "overall": 8.6
    },
    "model_b": {
      "completeness": 7,
      "accuracy": 9,
      "actionability": 6,
      "conciseness": 9,
      "overall": 7.7
    }
  },
  "reason": "Model A 在完整性和可执行性上表现更优，完整覆盖了所有核心议题和行动项，且每条行动项均包含明确负责人与截止时间。Model B 准确性略高，对会议内容的描述更为精确，但遗漏了两项关键决策。在简洁性方面，Model B 的表述更为精炼，避免了重复信息。综合来看，Model A 因完整性和可执行性的优势取得更高总分。"
}`
}

export default defineEventHandler(async (event: H3Event) => {
    const config = useRuntimeConfig()
    const body = await readBody(event)
    const { transcript, outputA, outputB, providerA, providerB } = body

    if (!transcript || !outputA || !outputB || !providerA || !providerB) {
        throw createError({ statusCode: 400, message: 'Missing required fields.' })
    }

    // Pick the third provider as judge
    const judgeProvider = ALL_PROVIDERS.find((p) => p !== providerA && p !== providerB) as TProvider
    const judgeClient = buildJudgeClient(judgeProvider, config as unknown as Record<string, string>)

    // Silently skip if judge provider is not configured
    if (!judgeClient) {
        return null
    }

    // Randomly swap A/B to reduce position bias, then swap back
    const swapped = Math.random() < 0.5
    const [firstOutput, secondOutput] = swapped ? [outputB, outputA] : [outputA, outputB]

    const prompt = buildJudgePrompt(transcript, firstOutput, secondOutput)

    try {
        const response = await judgeClient.client.chat.completions.create({
            model: judgeClient.model,
            max_tokens: 1024,
            temperature: 0,
            messages: [{ role: 'user', content: prompt }],
        })

        const raw = response.choices[0]?.message.content ?? ''
        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const parsed = JSON.parse(cleaned) as IJudgeResponse

        // If we swapped, invert the result back
        if (swapped) {
            const tmp = parsed.scores.model_a
            parsed.scores.model_a = parsed.scores.model_b
            parsed.scores.model_b = tmp
            if (parsed.winner === 'model_a') parsed.winner = 'model_b'
            else if (parsed.winner === 'model_b') parsed.winner = 'model_a'
        }

        parsed.judgeProvider = judgeProvider

        // Persist to DB (fire and forget)
        useDb()
            .insert(judgeResults)
            .values({
                id: crypto.randomUUID(),
                providerA,
                providerB,
                judgeProvider,
                winner: parsed.winner,
                scoresA: JSON.stringify(parsed.scores.model_a),
                scoresB: JSON.stringify(parsed.scores.model_b),
                reason: parsed.reason,
                createdAt: new Date().toISOString(),
            })
            .catch(() => { /* 日志写失败不影响主流程 */ })

        return parsed
    } catch {
        return null
    }
})
