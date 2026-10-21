<template>
  <div class="page">
    <header class="page-header">消息</header>

    <div v-if="loading" class="empty-hint">加载中…</div>
    <div v-else-if="!contacts.length" class="empty-hint">
      还没有联系人。去首页关注喜欢的创作者，或等别人关注你
    </div>

    <div v-else class="contact-list">
      <div
        v-for="c in contacts"
        :key="c.id"
        class="contact"
        @click="$router.push({ path: `/chat/${c.id}`, query: { name: c.username } })"
      >
        <div class="avatar">
          <img v-if="c.avatar_url" :src="c.avatar_url" alt="" />
          <span v-else>{{ c.username.slice(0, 1).toUpperCase() }}</span>
        </div>
        <div class="info">
          <div class="name">@{{ c.username }}</div>
          <div class="sub">{{ c.bio || relText(c.id) }}</div>
        </div>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m9 5 7 7-7 7" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '@/api'
import { errMsg } from '@/api/http'
import { toast } from '@/utils/toast'
import type { Account } from '@/types'

const contacts = ref<Account[]>([])
const followingIds = ref<Set<number>>(new Set())
const followerIds = ref<Set<number>>(new Set())
const loading = ref(false)

function relText(id: number) {
  const a = followingIds.value.has(id)
  const b = followerIds.value.has(id)
  if (a && b) return '互相关注'
  if (a) return '我关注的人'
  return '我的粉丝'
}

onMounted(async () => {
  loading.value = true
  try {
    const [vloggers, followers] = await Promise.all([api.myVloggers(), api.myFollowers()])
    followingIds.value = new Set((vloggers || []).map((a) => a.id))
    followerIds.value = new Set((followers || []).map((a) => a.id))
    // 按 id 合并去重
    const map = new Map<number, Account>()
    ;[...(vloggers || []), ...(followers || [])].forEach((a) => map.set(a.id, a))
    contacts.value = [...map.values()]
  } catch (e) {
    toast(errMsg(e))
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.contact-list {
  padding: 4px 0;
}

.contact {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
}

.contact:active {
  background: rgba(255, 255, 255, 0.04);
}

.avatar {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: #3a3a41;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  flex: none;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.info {
  flex: 1;
  min-width: 0;
}

.name {
  font-weight: 600;
}

.sub {
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
