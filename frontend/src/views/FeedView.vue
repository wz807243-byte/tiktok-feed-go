<template>
  <div class="feed-view">
    <TopTabs :model-value="tab" @update:model-value="selectTab" />

    <!-- 关注 Tab 未登录态 -->
    <div v-if="tab === 'following' && !auth.isLoggedIn" class="login-wall">
      <p>登录后查看你关注的人的视频</p>
      <button class="btn-primary" style="width: 200px" @click="goLogin">去登录</button>
    </div>

    <template v-else>
      <div v-if="linkError" class="feed-empty" role="status">
        {{ linkError }}
        <button class="btn-primary" @click="clearVideoLink">返回推荐</button>
      </div>
      <VideoSwiper
        v-else-if="current.list.length && !linkLoading"
        :key="tab + ':' + auth.accountId"
        :videos="current.list"
        v-model:activeIndex="current.active"
        :loading="current.loading"
        :has-more="current.hasMore && !current.error"
        @loadmore="loadMore"
        @open-comments="openComments"
      />
      <div v-else-if="current.loading || linkLoading" class="feed-empty">加载中…</div>
      <div v-else class="feed-empty">
        <template v-if="current.error">{{ current.error }}<button class="btn-primary" @click="loadMore">重试</button></template>
        <template v-else-if="tab === 'following'">你关注的人还没有发布视频</template>
        <template v-else>暂无视频，去发布第一条吧</template>
      </div>
    </template>

    <button v-if="current.error && current.list.length" class="feed-retry" @click="loadMore">加载失败，点击重试</button>
    <CommentPanel v-model="commentVisible" :video-id="commentVideoId" />
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TopTabs from '@/components/TopTabs.vue'
import VideoSwiper from '@/components/VideoSwiper.vue'
import CommentPanel from '@/components/CommentPanel.vue'
import { api } from '@/api'
import { errMsg } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { useSocialStore } from '@/stores/social'
import { toast } from '@/utils/toast'
import type { FeedVideoItem, VideoItem } from '@/types'

defineOptions({ name: 'FeedView' })
interface FeedState {
  list: FeedVideoItem[]; cursor: number; hasMore: boolean
  loading: boolean; loaded: boolean; active: number; error: string
}
const newState = (): FeedState => ({ list: [], cursor: 0, hasMore: true, loading: false, loaded: false, active: 0, error: '' })
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const social = useSocialStore()
const tab = ref<'recommend' | 'following'>(route.query.tab === 'following' ? 'following' : 'recommend')
const feeds = reactive({ recommend: newState(), following: newState() })
const current = computed(() => feeds[tab.value])

const linkLoading = ref(false)
const linkError = ref('')
let routeRevision = 0
let processedRoute = ''
let viewerId = auth.accountId

watch(tab, () => { if (!current.value.loaded) loadMore() })
watch(() => [route.path, route.query.tab, route.query.video, route.query.author, route.query.refresh, auth.accountId], syncRoute)
watch(() => [social.followingIds.join(','), social.pendingChanges] as const, ([ids, pending], [previousIds]) => {
  if (ids !== previousIds) feeds.following = newState()
  // 关注集合先乐观更新，等提交完成再读流，避免把提交前的结果缓存下来。
  if (!pending && route.path === '/feed' && tab.value === 'following' && !feeds.following.loaded) {
    if (route.query.video) { processedRoute = ''; syncRoute() }
    else loadMore()
  }
})

function selectTab(value: string) {
  router.replace({ path: '/feed', query: value === 'following' ? { tab: 'following' } : {} })
}

function positiveId(value: unknown) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return 0
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : 0
}

async function syncRoute() {
  if (route.path !== '/feed') { routeRevision++; processedRoute = ''; return }
  const key = JSON.stringify([route.query.tab, route.query.video, route.query.author, route.query.refresh, auth.accountId])
  if (processedRoute === key) return
  processedRoute = key
  const revision = ++routeRevision
  if (viewerId !== auth.accountId) {
    feeds.recommend = newState()
    feeds.following = newState()
    viewerId = auth.accountId
  }
  if (route.query.refresh) feeds.recommend = newState()
  tab.value = route.query.tab === 'following' ? 'following' : 'recommend'
  linkError.value = ''
  linkLoading.value = false
  const videoId = positiveId(route.query.video)
  if (route.query.video && !videoId) {
    linkError.value = '视频链接无效'
    return
  }
  if (videoId) {
    const state = current.value
    linkLoading.value = true
    try {
      let selected = state.list.find(video => video.id === videoId)
      if (!selected) selected = await resolveLinkedVideo(videoId, positiveId(route.query.author))
      if (revision !== routeRevision) return
      if (!selected) {
        linkError.value = '未找到链接中的视频，视频可能已不存在或超出可查询范围'
        return
      }
      const index = state.list.findIndex(video => video.id === videoId)
      if (index < 0) state.list.unshift(selected)
      state.active = Math.max(index, 0)
    } catch (error) {
      if (revision === routeRevision) linkError.value = '无法打开该视频：' + errMsg(error)
      return
    } finally { if (revision === routeRevision) linkLoading.value = false }
  }
  if (!current.value.loaded) loadMore()
}

async function resolveLinkedVideo(id: number, authorId: number): Promise<FeedVideoItem | undefined> {
  if (authorId) {
    const works = await api.videosByAuthor(authorId)
    const video = (works || []).find(item => item.id === id)
    if (!video) return undefined
    let username = video.username
    if (!username) username = (await api.findByID(authorId)).username
    const liked = auth.isLoggedIn ? (await api.myLikedVideos()) || [] : []
    return asFeedVideo(video, username, liked.some(item => item.id === id))
  }
  // 兼容旧的仅带 video 参数的分享链接；限制扫描量，避免无限请求。
  let cursor = 0
  for (let page = 0; page < 5; page++) {
    const response = await api.feedLatest(50, cursor)
    const video = (response.video_list || []).find(item => item.id === id)
    if (video) return video
    if (!response.has_more || response.next_time <= 0 || (cursor > 0 && response.next_time >= cursor)) break
    cursor = response.next_time
  }
}

function asFeedVideo(video: VideoItem, username: string, isLiked: boolean): FeedVideoItem {
  return {
    id: video.id, author: { id: video.author_id, username }, title: video.title,
    description: video.description, play_url: video.play_url, cover_url: video.cover_url,
    create_time: Math.floor(Date.parse(video.create_time) / 1000) || 0,
    likes_count: video.likes_count, is_liked: isLiked
  }
}

function clearVideoLink() { router.replace({ path: '/feed' }) }

async function loadMore() {
  const source = tab.value
  if (source === 'following' && (!auth.isLoggedIn || social.pendingChanges > 0)) return
  const state = feeds[source]
  if (state.loading || (!state.hasMore && state.loaded)) return
  state.loading = true
  state.error = ''
  try {
    // 两个端点各自回传的游标原样使用：推荐为毫秒，关注为秒。
    const fetcher = source === 'recommend' ? api.feedLatest : api.feedFollowing
    const response = await fetcher(10, state.cursor)
    const seen = new Set(state.list.map(video => video.id))
    const items = (response.video_list || []).filter(video => {
      if (seen.has(video.id)) return false
      seen.add(video.id)
      return true
    })
    state.list.push(...items)
    state.hasMore = response.has_more && response.next_time > 0 &&
      (state.cursor === 0 || response.next_time < state.cursor)
    state.cursor = response.next_time
    state.loaded = true
  } catch (error) {
    state.error = errMsg(error)
    toast(state.error)
  } finally { state.loading = false }
}

const commentVisible = ref(false)
const commentVideoId = ref(0)
function openComments(video: FeedVideoItem) {
  commentVideoId.value = video.id
  commentVisible.value = true
}
function goLogin() { router.push({ path: '/login', query: { redirect: '/feed?tab=following' } }) }
onMounted(syncRoute)
onActivated(syncRoute)
</script>

<style scoped>
.feed-retry { position: absolute; bottom: calc(var(--nav-h) + 16px); left: 50%; transform: translateX(-50%); z-index: 45; background: #29292f; color: #fff; padding: 10px 16px; border-radius: 18px; }
.feed-view {
  position: relative;
  height: 100%;
  /* 底部导航悬浮在视频之上，Feed 内容占满全高 */
  padding-bottom: var(--nav-h);
  box-sizing: border-box;
}

@media (min-width: 900px) {
  .feed-view {
    padding-bottom: 0;
  }
}

.login-wall {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  color: var(--text-secondary);
}

.feed-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 16px;
  color: var(--text-secondary);
}
</style>
