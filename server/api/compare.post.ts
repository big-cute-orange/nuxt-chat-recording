import OpenAI from 'openai';
import { defineEventHandler, readBody, createError, type H3Event } from 'h3';

const SYSTEM_PROMPT = `You are an expert meeting analyst. Analyze the provided meeting transcript and extract structured information.

You MUST respond with valid JSON only. No markdown, no code blocks, just raw JSON.

Return this exact structure:
{
  "summary": "2-4 paragraph executive summary of the meeting",
  "actionItems": [
    {
      "task": "Clear description of what needs to be done",
      "owner": "Name or 'Unassigned' if not specified",
      "deadline": "Date/timeframe or 'No deadline set'",
      "priority": "high|medium|low"
    }
  ],
  "decisions": [
    {
      "decision": "What was decided",
      "rationale": "Why this decision was made (brief)",
      "madeBy": "Who decided or 'Group decision'"
    }
  ],
  "participants": ["Name1", "Name2"],
  "meetingType": "e.g. Sprint Planning, Client Review, Team Standup, etc.",
  "keyTopics": ["topic1", "topic2", "topic3"]
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
            if (!config.doubaoApiKey) throw new Error('Doubao API key not configured.');
            if (!config.doubaoModelId) throw new Error('Doubao model endpoint ID (DOUBAO_MODEL_ID) not configured.');
            return {
                client: new OpenAI({ apiKey: config.doubaoApiKey, baseURL: 'https://ark.cn-beijing.volces.com/api/v3' }),
                model: config.doubaoModelId,
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

function parseResult(raw: string) {
    const cleaned = raw
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

    return JSON.parse(cleaned);
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
