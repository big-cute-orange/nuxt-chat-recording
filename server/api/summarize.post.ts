import OpenAI from 'openai';
import { defineEventHandler, readBody, setResponseHeaders, createError, type H3Event } from 'h3';

const JSON_SCHEMA = `
Return this exact JSON structure — no markdown, no code blocks, just raw JSON:
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

const TRANSCRIPT_PROMPT = `You are an expert meeting analyst. Analyze the provided meeting transcript and extract structured information.

You MUST respond with valid JSON only.${JSON_SCHEMA}`;

const FREE_NOTES_PROMPT = `You are an expert meeting assistant. The user has provided raw, unstructured notes taken during a meeting. These may be bullet points, fragments, abbreviations, shorthand, or stream-of-consciousness text — not a clean transcript.

Your job is to interpret these notes intelligently and reconstruct the meeting structure:
- Infer who was likely present from any names, roles, or initials mentioned
- Identify tasks and who they likely belong to, even if not explicitly assigned
- Detect decisions even if written as "→ do X" or "agreed: Y"
- Infer priorities from urgency language ("ASAP", "urgent", "when we have time", "low prio", etc.)
- Write the summary in polished, professional prose — not a reflection of the note style
- If something is ambiguous, make a reasonable inference rather than leaving it empty

You MUST respond with valid JSON only.${JSON_SCHEMA}`;

type TProvider = 'deepseek' | 'qwen' | 'doubao';

interface IProviderConfig {
    client: OpenAI;
    model: string;
    apiKeyName: string;
}

function buildProviderConfig(provider: TProvider, config: Record<string, string>): IProviderConfig {
    switch (provider) {
        case 'deepseek':
            return {
                client: new OpenAI({
                    apiKey: config.deepseekApiKey,
                    baseURL: 'https://api.deepseek.com/v1',
                }),
                model: 'deepseek-chat',
                apiKeyName: 'DeepSeek API key',
            };
        case 'qwen':
            return {
                client: new OpenAI({
                    apiKey: config.qwenApiKey,
                    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
                }),
                model: 'qwen-plus',
                apiKeyName: 'Qwen API key',
            };
        case 'doubao':
            return {
                client: new OpenAI({
                    apiKey: config.dobaoApiKey,
                    baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
                    timeout: 30_000, // 30s，防止接入点 ID 错误时无限挂起
                }),
                // 豆包需要填写你在火山引擎创建的推理接入点 ID
                model: config.dobaoModelId || '',
                apiKeyName: 'Doubao API key',
            };
    }
}

export default defineEventHandler(async (event: H3Event) => {
    const config = useRuntimeConfig();
    const body = await readBody(event);
    const { text, provider, inputType } = body;
    const SYSTEM_PROMPT = inputType === 'free-notes' ? FREE_NOTES_PROMPT : TRANSCRIPT_PROMPT;

    if (!text || text.trim().length < 10) {
        throw createError({ statusCode: 400, message: 'Text is too short.' });
    }

    if (!['deepseek', 'qwen', 'doubao'].includes(provider)) {
        throw createError({ statusCode: 400, message: 'Invalid provider.' });
    }

    const { client, model, apiKeyName } = buildProviderConfig(provider as TProvider, config as unknown as Record<string, string>);

    if (!client.apiKey) {
        throw createError({ statusCode: 400, message: `${apiKeyName} is not configured.` });
    }

    if (provider === 'doubao' && !model) {
        throw createError({ statusCode: 400, message: 'Doubao model endpoint ID (DOUBAO_MODEL_ID) is not configured.' });
    }

    setResponseHeaders(event, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
    });

    const stream = event.node.res;
    const userMessage =
        inputType === 'free-notes'
            ? `Please structure these raw meeting notes:\n\n${text}`
            : `Please analyze this meeting transcript:\n\n${text}`;

    try {
        let fullText = '';

        const response = await client.chat.completions.create({
            model,
            max_tokens: 2048,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userMessage },
            ],
            stream: true,
        });

        for await (const chunk of response) {
            const delta = chunk.choices[0]?.delta?.content || '';

            if (delta) {
                fullText += delta;
                stream.write(`data: ${JSON.stringify({ chunk: delta })}\n\n`);
            }
        }

        // 在所有 chunk 接收完后统一发送 done，不依赖 finish_reason 的具体值
        // 避免不同 provider 返回不同 finish_reason 导致前端永远等待
        stream.write(`data: ${JSON.stringify({ done: true, full: fullText })}\n\n`);
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';

        stream.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
    } finally {
        stream.end();
    }
});
