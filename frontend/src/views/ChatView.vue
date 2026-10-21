<template>
  <div class="chat-page">
    <header class="page-header chat-head">
      <button class="back" aria-label="返回" @click="$router.back()">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m15 5-7 7 7 7" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <span>@{{ peerName }}</span>
      <button class="refresh" aria-label="刷新" @click="load">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </header>

    <div ref="scrollBox" class="msg-list">
      <div v-if="loading" class="empty-hint">加载中…</div>
      <div v-else-if="!list.length" class="empty-hint">打个招呼吧</div>
      <div
        v-for="m in list"
        :key="m.id"
        class="msg-row"
        :class="{ mine: m.from_id === auth.accountId }"
      >
        <div class="bubble">{{ m.content }}</div>
      </div>
    </div>

    <footer class="input-bar">
      <input v-model="input" placeholder="发送私信…" maxlength="500" @keyup.enter="send" />
      <button class="send" :disabled="!input.trim() || sending" @click="send">发送</button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '@/api'
import { errMsg } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { toast } from '@/utils/toast'
import type { MessageItem } from '@/types'

const route = useRoute()
const auth = useAuthStore()

const peerId = Number(route.params.peerId)
const peerName = String(route.query.name || peerId)

const list = ref<MessageItem[]>([])
const loading = ref(false)
const input = ref('')
const sending = ref(false)
const scrollBox = ref<HTMLElement>()

async function load() {
  loading.value = true
  try {
    const { messages } = await api.messages(peerId)
    // 后端按 created_at 倒序返回最近 100 条，前端翻转为正序展示
    list.value = (messages || []).slice().reverse()
    await nextTick()
    scrollBox.value?.scrollTo({ top: scrollBox.value.scrollHeight })
  } catch (e) {
    toast(errMsg(e))
  } finally {
    loading.value = false
  }
}

async function send() {
  const content = input.value.trim()
  if (!content || sending.value) return
  sending.value = true
  try {
    await api.sendMessage(peerId, content)
    input.value = ''
    await load()
  } catch (e) {
    toast(errMsg(e))
  } finally {
    sending.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.chat-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

@media (min-width: 900px) {
  .chat-page {
    max-width: 720px;
    margin: 0 auto;
    border-left: 0.5px solid var(--border-subtle);
    border-right: 0.5px solid var(--border-subtle);
  }
}

.chat-head {
  flex: none;
  justify-content: center;
  position: relative;
}

.back {
  position: absolute;
  left: 10px;
}

.refresh {
  position: absolute;
  right: 10px;
  color: var(--text-secondary);
}

.msg-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

.msg-row {
  display: flex;
  margin-bottom: 10px;
}

.msg-row.mine {
  justify-content: flex-end;
}

.bubble {
  max-width: 75%;
  padding: 10px 14px;
  border-radius: 14px 14px 14px 4px;
  background: #2a2a30;
  word-break: break-all;
}

.msg-row.mine .bubble {
  border-radius: 14px 14px 4px 14px;
  background: var(--accent-red);
}

.input-bar {
  flex: none;
  display: flex;
  gap: 10px;
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px));
  border-top: 0.5px solid var(--border-subtle);
  background: var(--bg-nav);
}

.input-bar input {
  flex: 1;
  padding: 10px 14px;
}

.send {
  padding: 0 18px;
  border-radius: var(--radius-md);
  background: var(--accent-red);
  font-weight: 600;
}

.send:disabled {
  opacity: 0.5;
}
</style>
