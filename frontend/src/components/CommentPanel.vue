<template>
  <teleport to="body">
    <transition name="panel">
      <div v-if="modelValue" class="comment-root">
        <div class="mask" @click="close"></div>
        <div class="sheet" :style="{ transform: `translateY(${dragY}px)` }">
          <div
            class="grabber"
            @pointerdown="onDragStart"
            @pointermove="onDragMove"
            @pointerup="onDragEnd"
            @pointercancel="onDragEnd"
          >
            <i></i>
          </div>
          <header class="head">
            <span>{{ list.length }} 条评论</span>
            <button class="close" aria-label="关闭" @click="close">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
              </svg>
            </button>
          </header>

          <div class="list">
            <div v-if="loading" class="hint">加载中…</div>
            <div v-else-if="!list.length" class="hint">还没有评论，来抢沙发</div>
            <div v-for="c in list" :key="c.id" class="comment">
              <div class="c-avatar">{{ c.username.slice(0, 1).toUpperCase() }}</div>
              <div class="c-body">
                <div class="c-name">@{{ c.username }}</div>
                <div class="c-text">{{ c.content }}</div>
                <div class="c-foot">
                  <span>{{ formatTime(c.created_at) }}</span>
                  <button v-if="c.author_id === auth.accountId" class="del" @click="remove(c)">删除</button>
                </div>
              </div>
            </div>
          </div>

          <footer class="input-bar">
            <template v-if="auth.isLoggedIn">
              <input
                v-model="input"
                placeholder="说点好听的…"
                maxlength="200"
                @keyup.enter="publish"
              />
              <button class="send" :disabled="!input.trim() || sending" @click="publish">发送</button>
            </template>
            <button v-else class="login-tip" @click="goLogin">登录后参与评论</button>
          </footer>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/api'
import { errMsg } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { useMetaStore } from '@/stores/meta'
import { formatTime } from '@/utils/format'
import { toast } from '@/utils/toast'
import type { CommentItem } from '@/types'

const props = defineProps<{ modelValue: boolean; videoId: number }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const auth = useAuthStore()
const meta = useMetaStore()
const router = useRouter()

const list = ref<CommentItem[]>([])
const loading = ref(false)
const input = ref('')
const sending = ref(false)

watch(
  () => [props.modelValue, props.videoId],
  ([visible]) => {
    if (visible) load()
  }
)

async function load() {
  loading.value = true
  try {
    const data = await api.comments(props.videoId)
    list.value = (data || []).slice().sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    meta.setCommentCount(props.videoId, list.value.length)
  } catch (e) {
    toast(errMsg(e))
  } finally {
    loading.value = false
  }
}

async function publish() {
  const content = input.value.trim()
  if (!content || sending.value) return
  sending.value = true
  try {
    const { comment } = await api.publishComment(props.videoId, content)
    list.value.unshift(comment)
    meta.setCommentCount(props.videoId, list.value.length)
    input.value = ''
  } catch (e) {
    toast(errMsg(e))
  } finally {
    sending.value = false
  }
}

async function remove(c: CommentItem) {
  try {
    await api.deleteComment(c.id)
    list.value = list.value.filter((x) => x.id !== c.id)
    meta.setCommentCount(props.videoId, list.value.length)
  } catch (e) {
    toast(errMsg(e))
  }
}

function goLogin() {
  close()
  router.push({ path: '/login', query: { redirect: '/feed' } })
}

function close() {
  emit('update:modelValue', false)
}

/* 下滑手势关闭 */
const dragY = ref(0)
let startY = 0
let dragging = false

function onDragStart(e: PointerEvent) {
  dragging = true
  startY = e.clientY
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onDragMove(e: PointerEvent) {
  if (!dragging) return
  dragY.value = Math.max(0, e.clientY - startY)
}

function onDragEnd() {
  if (!dragging) return
  dragging = false
  if (dragY.value > 90) close()
  dragY.value = 0
}
</script>

<style scoped>
.comment-root {
  position: fixed;
  inset: 0;
  z-index: 100;
}

.mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
}

.sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  max-width: 480px;
  margin: 0 auto;
  height: 65dvh;
  display: flex;
  flex-direction: column;
  background: var(--bg-panel);
  border-radius: 14px 14px 0 0;
  transition: transform 0.18s ease-out;
}

.grabber {
  padding: 10px 0 6px;
  display: flex;
  justify-content: center;
  touch-action: none;
  cursor: grab;
}

.grabber i {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.25);
}

.head {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  font-size: 14px;
  font-weight: 600;
  position: relative;
}

.close {
  position: absolute;
  right: 12px;
  color: var(--text-secondary);
}

.list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px;
}

.hint {
  padding: 40px 0;
  text-align: center;
  color: var(--text-tertiary);
}

.comment {
  display: flex;
  gap: 10px;
  padding: 12px 0;
}

.c-avatar {
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #3a3a41;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

.c-body {
  flex: 1;
  min-width: 0;
}

.c-name {
  font-size: 13px;
  color: var(--text-secondary);
}

.c-text {
  margin: 4px 0 6px;
  font-size: 14px;
  word-break: break-all;
}

.c-foot {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.del {
  color: var(--text-tertiary);
  font-size: 12px;
}

.input-bar {
  display: flex;
  gap: 10px;
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px));
  border-top: 0.5px solid var(--border-subtle);
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

.login-tip {
  flex: 1;
  padding: 11px;
  border-radius: var(--radius-md);
  background: var(--bg-input);
  color: var(--text-secondary);
}

.panel-enter-active,
.panel-leave-active {
  transition: opacity 0.25s;
}

.panel-enter-active .sheet,
.panel-leave-active .sheet {
  transition: transform 0.25s ease-out;
}

.panel-enter-from,
.panel-leave-to {
  opacity: 0;
}

.panel-enter-from .sheet,
.panel-leave-to .sheet {
  transform: translateY(100%);
}
</style>
