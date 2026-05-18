// server/api/chat.post.ts
import { defineEventHandler, readBody, createError } from 'h3'

// 用于存储对话历史的简单结构
interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export default defineEventHandler(async (event) => {
  // 1.从请求体中获取用户消息
  const { messages } = (await readBody(event)) as { messages: Message[] }

  // 2.从运行时配置中安全地获取 API 密钥
  const config = useRuntimeConfig()
  const apiKey = config.apiKey
  const apiBaseUrl = config.aiBaseUrl

  if (!apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'API Key is not configured',
    })
  }

  if (!apiBaseUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: 'AI Base URL is not configured',
    })
  }

  try {
    // 3.调用 DeepSeek API
    const response = await fetch(`${apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat', // 使用的模型 [reference:4]
        messages: messages,
        stream: false, // 第 2 天我们先用非流式，第 3-4 天再升级为流式
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('API Error:', response.status, errorText)
      throw createError({
        statusCode: response.status,
        statusMessage: `API error: ${response.statusText}`,
      })
    }

    const result = await response.json()
    // 4.返回 AI 的回复
    return {
      role: 'assistant',
      content: result.choices[0].message.content,
    }
  } catch (error) {
    console.error('Error calling API:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to get response from AI',
    })
  }
})
