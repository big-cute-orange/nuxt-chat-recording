<template>
  <div class="chat-message">
    <div v-if="loading" class="loading"><span></span><span></span><span></span></div>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-else class="content" v-html="html"></div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  content: string
  loading?: boolean
}>()

const { render } = useMarkdown()
const html = computed(() => render(props.content))
</script>

<style scoped>
.chat-message {
  max-width: 85%;
  padding: 12px 16px;
  background: #f7f8fa;
  border-radius: 14px;
  line-height: 1.7;
}

.content :deep(pre) {
  background: #1e1e1e;
  color: #fff;
  padding: 12px;
  border-radius: 8px;
  margin: 10px 0;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.content :deep(code) {
  background: #eef1f5;
  padding: 2px 6px;
  border-radius: 4px;
  word-break: break-word;
  white-space: pre-wrap;
}

.content :deep(p) {
  margin: 6px 0;
}

.loading {
  display: flex;
  gap: 6px;
}
.loading span {
  width: 6px;
  height: 6px;
  background: #999;
  border-radius: 50%;
  animation: dot 1s infinite;
}
.loading span:nth-child(2) {
  animation-delay: 0.2s;
}
.loading span:nth-child(3) {
  animation-delay: 0.4s;
}
@keyframes dot {
  0%,
  100% {
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
}
</style>
