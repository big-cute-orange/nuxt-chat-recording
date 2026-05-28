import OpenAI from 'openai';
import { defineEventHandler, readBody, createError, type H3Event } from 'h3';
import { MeetingSummarySchema } from '~~/shared/schemas/meeting';

const SYSTEM_PROMPT = `You are an expert meeting analyst. Analyze the provided meeting transcript and extract structured information.

Detect the primary language of the input and write all text fields (summary, task descriptions, decisions, topics, etc.) in that same language.

You MUST respond with valid JSON only. No markdown, no code blocks, just raw JSON.

Return this exact structure:
{
  "summary": "2-4段会议执行摘要",
  "actionItems": [
    {
      "task": "行动项的清晰描述",
      "owner": "负责人姓名，若未指定则填'未分配'",
      "deadline": "日期或时间范围，若未设置则填'无截止日期'",
      "priority": "high|medium|low"
    }
  ],
  "decisions": [
    {
      "decision": "决策事项",
      "rationale": "决策原因（简述）",
      "madeBy": "决策人，若为集体决策则填'集体决策'"
    }
  ],
  "participants": ["姓名1", "姓名2"],
  "meetingType": "如：迭代规划、客户评审、每日站会等",
  "keyTopics": ["主题1", "主题2", "主题3"]
}`;

type TProvider = 'deepseek' | 'qwen' | 'doubao';

function buildClient(provider: TProvider, config: Record<string, string>): { client: OpenAI; model: string } {
    switch (provider) {
        case 'deepseek':
            if (!config.deepseekApiKey) throw new Error('DeepSeek API key not configured.');
            return {
                client: new OpenAI({ apiKey: config.deepseekApiKey, baseURL: 'https://api.deepseek.com/v1' }),
                model: 'deepseek-chat',
            };
        case 'qwen':
            if (!config.qwenApiKey) throw new Error('Qwen API key not configured.');
            return {
                client: new OpenAI({ apiKey: config.qwenApiKey, baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1' }),
                model: 'qwen-plus',
            };
        case 'doubao':
            if (!config.dobaoApiKey) throw new Error('Doubao API key not configured.');
            if (!config.dobaoModelId) throw new Error('Doubao model endpoint ID (DOBAO_MODEL_ID) not configured.');
            return {
                client: new OpenAI({ apiKey: config.dobaoApiKey, baseURL: 'https://ark.cn-beijing.volces.com/api/v3', timeout: 120_000 }),
                model: config.dobaoModelId,
            };
    }
}

async function callProvider(provider: TProvider, text: string, config: Record<string, string>): Promise<string> {
    const { client, model } = buildClient(provider, config);
    const userMessage = `Please analyze this meeting transcript:\n\n${text}`;

    const response = await client.chat.completions.create({
        model,
        max_tokens: 2048,
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userMessage },
        ],
    });

    return response.choices[0]?.message.content ?? '';
}

// function parseResult(raw: string) {
//     const cleaned = raw
//         .replace(/```json\n?/g, '')
//         .replace(/```\n?/g, '')
//         .trim();

//     return JSON.parse(cleaned);
// }
function parseResult(raw: string) {
    const cleaned = raw
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
    const result = MeetingSummarySchema.safeParse(JSON.parse(cleaned));
    if (!result.success) {
        console.warn('[AI] Schema validation failed:', result.error.flatten());
        return null;
    }
    return result.data;
}

export default defineEventHandler(async (event: H3Event) => {
    const config = useRuntimeConfig();
    const body = await readBody(event);
    const { text, providers } = body;

    if (!text || text.trim().length < 10) {
        throw createError({ statusCode: 400, message: 'Transcript is too short.' });
    }

    if (!Array.isArray(providers) || providers.length !== 2) {
        throw createError({ statusCode: 400, message: 'Exactly 2 providers required.' });
    }

    const [resultA, resultB] = await Promise.allSettled([
        callProvider(providers[0], text, config as unknown as Record<string, string>),
        callProvider(providers[1], text, config as unknown as Record<string, string>),
    ]);

    const parseSettled = (settled: PromiseSettledResult<string>) => {
        if (settled.status === 'rejected') {
            return { error: settled.reason?.message ?? 'Failed' };
        }

        try {
            return parseResult(settled.value);
        } catch {
            return { error: 'Failed to parse response as JSON.' };
        }
    };

    return {
        a: { provider: providers[0], result: parseSettled(resultA) },
        b: { provider: providers[1], result: parseSettled(resultB) },
    };
});
