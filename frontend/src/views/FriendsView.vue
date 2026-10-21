<template>
  <div class="page">
    <header class="page-header">好友</header>

    <div v-if="!auth.isLoggedIn" class="empty-hint">
      <p style="margin-bottom: 16px">登录后查看好友动态</p>
      <button class="btn-primary" style="width: 160px; margin: 0 auto" @click="$router.push('/login')">
        去登录
      </button>
    </div>

    <template v-else>
      <div v-if="loading" class="empty-hint">加载中…</div>
      <div v-else-if="!list.length" class="empty-hint">
        关注的人还没有新视频，去首页发现有趣的创作者吧
      </div>
      <div v-else class="video-grid">
        <div v-for="v in list" :key="v.id" class="cell" role="button" tabindex="0" @click="goFeed(v)" @keydown.enter="goFeed(v)">
          <img :src="v.cover_url" :alt="v.title" loading="lazy" />
          <span class="meta">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="#fff">
              <path d="M12 21c-4.8-3.9-9-7.2-9-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 3.8-4.2 7.1-9 11z" />
            </svg>
            {{ formatCount(v.likes_count) }}
          </span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { formatCount } from '@/utils/format'
import { toast } from '@/utils/toast'
import { errMsg } from '@/api/http'
import type { FeedVideoItem } from '@/types'

const auth = useAuthStore()
const router = useRouter()
const list = ref<FeedVideoItem[]>([])
const loading = ref(false)

function goFeed(video: FeedVideoItem) {
  router.push({ path: '/feed', query: { tab: 'following', video: String(video.id), author: String(video.author.id) } })
}

onMounted(async () => {
  if (!auth.isLoggedIn) return
  loading.value = true
  try {
    const resp = await api.feedFollowing(30, 0)
    list.value = resp.video_list || []
  } catch (e) {
    toast(errMsg(e))
  } finally {
    loading.value = false
  }
})
</script>
