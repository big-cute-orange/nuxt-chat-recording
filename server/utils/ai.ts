import OpenAI from 'openai'

export type TProvider = 'deepseek' | 'qwen' | 'doubao'

export interface IProviderConfig {
    client: OpenAI
    model: string
    apiKeyName: string
}

export function buildProviderConfig(provider: TProvider, config: Record<string, string>): IProviderConfig {
    switch (provider) {
        case 'deepseek':
            return {
                client: new OpenAI({
                    apiKey: config.deepseekApiKey,
                    baseURL: 'https://api.deepseek.com/v1',
                }),
                model: 'deepseek-chat',
                apiKeyName: 'DeepSeek API key',
            }
        case 'qwen':
            return {
                client: new OpenAI({
                    apiKey: config.qwenApiKey,
                    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
                }),
                model: 'qwen-plus',
                apiKeyName: 'Qwen API key',
            }
        case 'doubao':
            return {
                client: new OpenAI({
                    apiKey: config.dobaoApiKey,
                    baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
                    timeout: 30_000,
                }),
                model: config.dobaoModelId || '',
                apiKeyName: 'Doubao API key',
            }
    }
}
