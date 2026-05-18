<!-- pages/chat.vue -->
<template>
  <div class="chat-container">
    <!-- 消息展示区域 -->
    <div class="messages-area">
      <div v-for="(message, index) in messages" :key="index" :class="['message', message.role]">
        <div class="message-bubble">
          <strong>{{ message.role === 'user' ? '我' : 'AI' }}:</strong>
          <p v-if="message.role === 'user'">{{ message.content }}</p>
          <ChatMessage v-else :content="message.content" :loading="message.loading" />
        </div>
      </div>
      <!-- <div v-if="isLoading" class="message assistant loading">
        <div class="message-bubble">
          <strong>AI:</strong>
          <p>正在思考...</p>
        </div>
      </div> -->
    </div>

    <!-- 输入区域 -->
    <div class="input-area">
      <input
        v-model="userInput"
        type="text"
        placeholder="输入消息，按回车发送..."
        :disabled="isLoading"
        @keyup.enter="sendMessage"
      />
      <button :disabled="isLoading" @click="sendMessage">发送</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

// 定义消息列表，存储用户和 AI 的对话记录
const messages = ref([])
// 当前用户输入框的内容
const userInput = ref('')
// 是否正在等待 AI 回复
const isLoading = ref(false)

// 发送消息的核心方法
const sendMessage = async () => {
  // 如果用户输入为空，或者正在等待 AI 回复，则不做任何操作
  if (!userInput.value.trim() || isLoading.value) return

  // 1.将用户输入的消息添加到列表，并清空输入框
  const userMessage = { role: 'user', content: userInput.value }
  messages.value.push(userMessage)
  userInput.value = ''

  // 2.设置加载状态，并准备 AI 消息占位符
  isLoading.value = true
  const assistantMessage = { role: 'assistant', content: '' }
  messages.value.push(assistantMessage)

  try {
    // 3.发送 POST 请求到后端 API
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: messages.value,
      }),
    })

    // 4.检查请求是否成功
    if (!response.ok) {
      throw new Error(`请求失败: ${response.status}`)
    }

    // 5.读取返回的数据
    const data = await response.json()
    // 更新我们为 AI 创建的占位消息
    assistantMessage.content = data.content
  } catch (error) {
    console.error('出错了:', error)
    assistantMessage.content = '抱歉，请求出错了，请稍后再试。'
  } finally {
    // 6. 无论成功与否，都关闭加载状态
    isLoading.value = false
  }
}
</script>

<style scoped>
.chat-container {
  max-width: 800px;
  margin: 0 auto;
  height: 100vh;
  display: flex;
  flex-direction: column;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}
.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.message {
  display: flex;
}
.message.user {
  justify-content: flex-end;
}
.message.assistant {
  justify-content: flex-start;
}
.message-bubble {
  max-width: 70%;
  padding: 0.5rem 1rem;
  border-radius: 1rem;
  background-color: #f1f5f9;
}
.message.user .message-bubble {
  background-color: #3b82f6;
  color: white;
}
.input-area {
  display: flex;
  padding: 1rem;
  border-top: 1px solid #e2e8f0;
  gap: 0.5rem;
}
.input-area input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.375rem;
  outline: none;
}
.input-area button {
  padding: 0.5rem 1rem;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
}
.input-area button:disabled {
  background-color: #94a3b8;
  cursor: not-allowed;
}
</style>
