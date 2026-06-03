import OpenAI from 'openai'

const QWEN_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const EMBEDDING_MODEL = 'text-embedding-v3'
const BATCH_SIZE = 10 // DashScope text-embedding-v3 limit

export async function embedTexts(texts: string[], qwenApiKey: string): Promise<number[][]> {
    if (texts.length === 0) return []

    const client = new OpenAI({ apiKey: qwenApiKey, baseURL: QWEN_BASE_URL })
    const allVectors: number[][] = []

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE)
        const response = await client.embeddings.create({ model: EMBEDDING_MODEL, input: batch })
        const sorted = response.data.sort((a, b) => a.index - b.index)

        allVectors.push(...sorted.map((d) => d.embedding))
    }

    return allVectors
}
