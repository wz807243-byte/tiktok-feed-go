<template>
  <div class="page">
    <header class="page-header">我</header>

    <div v-if="!auth.isLoggedIn" class="empty-hint">
      <p style="margin-bottom: 16px">登录后查看个人主页</p>
      <button class="btn-primary" style="width: 160px; margin: 0 auto" @click="$router.push('/login')">
        去登录
      </button>
    </div>

    <template v-else>
      <!-- 资料卡 -->
      <section class="profile">
        <label class="avatar-lg" title="点击更换头像">
          <input type="file" accept="image/jpeg,image/png,image/webp" hidden @change="onAvatarChange" />
          <img v-if="profile?.avatar_url" :src="profile.avatar_url" alt="" />
          <span v-else>{{ auth.username.slice(0, 1).toUpperCase() }}</span>
        </label>
        <div class="p-info">
          <div class="p-name">@{{ auth.username }}</div>
          <div class="p-bio" @click="editBio">
            {{ profile?.bio || '点击添加简介…' }}
          </div>
          <div class="p-counts">
            <span><b>{{ counts.vlogger_count }}</b> 关注</span>
            <span><b>{{ counts.follower_count }}</b> 粉丝</span>
          </div>
        </div>
        <button class="logout" @click="onLogout">退出</button>
      </section>

      <!-- 作品 / 喜欢 -->
      <div class="grid-tabs">
        <button :class="{ on: gridTab === 'works' }" @click="switchTab('works')">作品</button>
        <button :class="{ on: gridTab === 'liked' }" @click="switchTab('liked')">喜欢</button>
      </div>

      <div v-if="gridLoading" class="empty-hint">加载中…</div>
      <div v-else-if="!gridList.length" class="empty-hint">
        {{ gridTab === 'works' ? '还没有发布过视频' : '还没有喜欢的视频' }}
      </div>
      <div v-else class="video-grid">
        <div v-for="v in gridList" :key="v.id" class="cell" role="button" tabindex="0" @click="goVideo(v)" @keydown.enter="goVideo(v)">
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
import { errMsg } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { useSocialStore } from '@/stores/social'
import { formatCount } from '@/utils/format'
import { toast } from '@/utils/toast'
import type { Account, SocialCounts, VideoItem } from '@/types'

const auth = useAuthStore()
const social = useSocialStore()
const router = useRouter()

const profile = ref<Account | null>(null)
const counts = ref<SocialCounts>({ follower_count: 0, vlogger_count: 0 })
const gridTab = ref<'works' | 'liked'>('works')
const gridList = ref<VideoItem[]>([])
const gridLoading = ref(false)

async function loadProfile() {
  if (!auth.isLoggedIn) return
  try {
    const [p, c] = await Promise.all([api.findByID(auth.accountId), api.socialCounts()])
    profile.value = p
    counts.value = c
  } catch {
    /* 静默 */
  }
}

async function loadGrid() {
  if (!auth.isLoggedIn) return
  gridLoading.value = true
  try {
    gridList.value =
      gridTab.value === 'works'
        ? await api.videosByAuthor(auth.accountId)
        : await api.myLikedVideos()
  } catch (e) {
    toast(errMsg(e))
  } finally {
    gridLoading.value = false
  }
}

function goVideo(video: VideoItem) {
  router.push({ path: '/feed', query: { video: String(video.id), author: String(video.author_id) } })
}

function switchTab(t: 'works' | 'liked') {
  if (gridTab.value === t) return
  gridTab.value = t
  loadGrid()
}

async function onAvatarChange(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  try {
    const { avatar_url } = await api.uploadAvatar(f)
    await api.updateProfile(avatar_url, profile.value?.bio || '')
    if (profile.value) profile.value.avatar_url = avatar_url
    toast('头像已更新')
  } catch (e2) {
    toast(errMsg(e2))
  }
}

function editBio() {
  const bio = window.prompt('编辑简介（255 字以内）', profile.value?.bio || '')
  if (bio === null) return
  const nextBio = Array.from(bio.trim()).slice(0, 255).join('')
  api
    .updateProfile(profile.value?.avatar_url || '', nextBio)
    .then(() => {
      if (profile.value) profile.value.bio = nextBio
      toast('简介已更新')
    })
    .catch((e) => toast(errMsg(e)))
}

async function onLogout() {
  await auth.logout()
  social.$reset()
  toast('已退出登录')
  router.push('/feed')
}

onMounted(() => {
  loadProfile()
  loadGrid()
})
</script>

<style scoped>
.profile {
  display: flex;
  gap: 14px;
  padding: 20px 16px;
  align-items: flex-start;
}

.avatar-lg {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: #3a3a41;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  font-weight: 600;
  flex: none;
  cursor: pointer;
}

.avatar-lg img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.p-info {
  flex: 1;
  min-width: 0;
}

.p-name {
  font-size: 18px;
  font-weight: 700;
}

.p-bio {
  margin: 6px 0;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
}

.p-counts {
  display: flex;
  gap: 18px;
  font-size: 13px;
  color: var(--text-secondary);
}

.p-counts b {
  color: #fff;
  font-size: 15px;
}

.logout {
  padding: 6px 14px;
  border: 0.5px solid rgba(255, 255, 255, 0.3);
  border-radius: 16px;
  font-size: 13px;
  color: var(--text-secondary);
}

.grid-tabs {
  display: flex;
  border-bottom: 0.5px solid var(--border-subtle);
}

.grid-tabs button {
  flex: 1;
  padding: 12px 0;
  font-size: 15px;
  color: var(--text-secondary);
  position: relative;
}

.grid-tabs button.on {
  color: #fff;
  font-weight: 600;
}

.grid-tabs button.on::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: 28px;
  height: 2px;
  background: #fff;
}
</style>
