<template>
  <div class="page hot-page">
    <div class="hot-content">
      <header class="hot-heading">
        <div>
          <span class="hot-kicker"><i></i> 正在热播</span>
          <h1>热度榜<span class="flame" aria-hidden="true">↗</span></h1>
          <p>热门内容，一起发现。</p>
        </div>
        <button class="refresh-hot" :disabled="loading" @click="refreshRanking">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M5.5 8a7 7 0 0 1 12-3L20 8M4 16l2.5 3a7 7 0 0 0 12-3" stroke-linecap="round" stroke-linejoin="round" /></svg>
          {{ loading ? '更新中' : '刷新榜单' }}
        </button>
      </header>

      <div class="ranking-label">
        <h2>热门视频</h2>
        <span v-if="updatedAt">{{ updateTime }} 更新 · 已加载 {{ videos.length }} 条</span>
        <span v-else>发现值得一看的视频</span>
      </div>

      <div v-if="loading && !videos.length" class="hot-list skeletons" aria-label="正在加载热度榜" aria-busy="true">
        <div v-for="n in 6" :key="n" class="hot-skeleton"><i></i><div><b></b><b></b><b></b></div></div>
      </div>
      <div v-else-if="!videos.length" class="hot-empty" role="status">
        <span class="empty-symbol" aria-hidden="true">↗</span>
        <h2>{{ error ? '榜单暂时无法加载' : '热度榜还在等你' }}</h2>
        <p>{{ error || '暂时没有热门视频，稍后再来看看。' }}</p>
        <button v-if="error" class="hot-primary" @click="refreshRanking">重新加载</button>
        <router-link v-else to="/feed" class="hot-primary">去首页看看</router-link>
      </div>
      <ol v-else class="hot-list" aria-label="热度视频排行" :aria-busy="loading">
        <li v-for="(video, index) in videos" :key="video.id">
          <button class="hot-card" :aria-label="'播放：' + video.title" @click="play(video)">
            <div class="hot-cover">
              <img v-if="!failedCovers.has(video.id)" :src="video.cover_url" :alt="video.title" loading="lazy" @error="failedCovers.add(video.id)" />
              <span v-else class="cover-fallback">{{ video.author.username.slice(0, 1).toUpperCase() }}</span>
              <span class="rank" :class="{ podium: index < 3 }">{{ String(index + 1).padStart(2, '0') }}</span>
              <span class="cover-play" aria-hidden="true">▶</span>
            </div>
            <div class="hot-details">
              <span class="top-label">{{ index < 3 ? '热门推荐' : '正在上榜' }}</span>
              <h3>{{ video.title }}</h3>
              <p class="hot-description">{{ video.description || '点击发现视频里的精彩' }}</p>
              <span class="hot-author">@{{ video.author.username }}</span>
              <div class="hot-meta">
                <span><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M12 21c-4.8-3.9-9-7.2-9-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 3.8-4.2 7.1-9 11z" /></svg>{{ formatCount(video.likes_count) }} 赞</span>
                <span class="watch-label">立即观看 <b aria-hidden="true">↗</b></span>
              </div>
            </div>
          </button>
        </li>
      </ol>

      <footer v-if="videos.length" class="hot-footer">
        <p v-if="error" role="alert">{{ error }}</p>
        <button v-if="hasMore || error" class="load-hot" :disabled="loading" @click="loadMore">{{ loading ? '加载中…' : error ? '重试加载' : '加载更多' }}</button>
        <span v-else>已经看完这期榜单了</span>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useHotFeed } from '@/composables/useHotFeed'
import { formatCount } from '@/utils/format'
import type { FeedVideoItem } from '@/types'

const router = useRouter()
const { videos, loading, error, hasMore, updatedAt, loadMore, refresh } = useHotFeed()
const failedCovers = reactive(new Set<number>())
function refreshRanking() { failedCovers.clear(); return refresh() }
const updateTime = computed(() => new Date(updatedAt.value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }))
function play(video: FeedVideoItem) {
  router.push({ path: '/feed', query: { video: video.id, author: video.author.id } })
}
onMounted(refreshRanking)
</script>

<style scoped>
.hot-page { background: radial-gradient(ellipse at 10% 0, rgba(254, 44, 85, .1), transparent 38%), #101014; }
.hot-content { max-width: 1280px; padding: 40px 32px 36px; margin: 0 auto; }
.hot-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 32px; border-bottom: 1px solid var(--border-subtle); }
.hot-kicker { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #ff9a88; letter-spacing: 2px; }
.hot-kicker i { width: 5px; height: 5px; border-radius: 50%; background: #ff7865; box-shadow: 0 0 10px #ff7865; }
h1 { font-size: 36px; line-height: 1.3; letter-spacing: 1px; margin: 8px 0; }
.flame { color: #ff775c; font-size: 40px; margin-left: 10px; font-weight: 400; }
.hot-heading p { font-size: 13px; color: var(--text-secondary); }
.refresh-hot, .load-hot { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 1px solid rgba(255, 255, 255, .16); padding: 10px 15px; border-radius: 10px; font-size: 13px; white-space: nowrap; background: rgba(255, 255, 255, .03); }
button:disabled { cursor: wait; opacity: .55; }
button:focus-visible, a:focus-visible { outline: 2px solid var(--accent-cyan); outline-offset: 4px; }
.refresh-hot:hover, .load-hot:hover { background: rgba(255, 255, 255, .08); }
.ranking-label { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 26px 0 16px; }
.ranking-label h2 { font-size: 16px; font-weight: 600; }
.ranking-label > span { color: var(--text-tertiary); font-size: 11px; }
.hot-list { list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
.hot-card { width: 100%; display: flex; gap: 14px; text-align: left; padding: 12px; border: 1px solid var(--border-subtle); background: #19191f; border-radius: 14px; transition: background .18s, border-color .18s, transform .18s; }
.hot-card:hover { border-color: rgba(254, 44, 85, .4); background: #202026; transform: translateY(-2px); }
.hot-cover { position: relative; flex: 0 0 104px; height: 148px; overflow: hidden; border-radius: 8px; background: linear-gradient(135deg, #3c2033, #242b46); }
.hot-cover img { width: 100%; height: 100%; object-fit: cover; }
.cover-fallback { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 40px; color: rgba(255, 255, 255, .4); }
.rank { position: absolute; top: 0; left: 0; min-width: 30px; padding: 2px 6px; border-radius: 0 0 8px 0; background: rgba(0, 0, 0, .7); font-size: 15px; font-weight: 800; font-style: italic; }
.rank.podium { background: linear-gradient(135deg, #ff864f, #fe2c55); }
.cover-play { position: absolute; bottom: 8px; right: 8px; display: grid; place-items: center; width: 24px; height: 24px; font-size: 10px; border-radius: 50%; background: rgba(0, 0, 0, .45); }
.hot-details { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.top-label { color: #ff8d79; font-size: 10px; margin-bottom: 6px; }
h3 { font-size: 14px; line-height: 1.5; font-weight: 600; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
.hot-description { font-size: 11px; color: var(--text-tertiary); margin-top: 6px; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
.hot-author { margin: auto 0 8px; padding-top: 8px; font-size: 11px; color: var(--text-secondary); white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
.hot-meta { display: flex; align-items: center; justify-content: space-between; gap: 6px; font-size: 10px; color: var(--text-secondary); }
.hot-meta > span { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.hot-meta svg { color: #ff6f85; }
.watch-label { color: rgba(255, 255, 255, .8); }
.watch-label b { font-weight: 400; color: #ff8d79; }
.hot-footer { text-align: center; padding: 28px 0 10px; font-size: 12px; color: var(--text-tertiary); }
.hot-footer p { margin-bottom: 12px; color: #ff8c9e; }
.load-hot { min-width: 160px; color: #fff; }
.hot-empty { text-align: center; padding: 64px 20px; }
.empty-symbol { display: block; color: #ff7b65; font-size: 48px; margin-bottom: 12px; }
.hot-empty h2 { font-size: 18px; }
.hot-empty p { margin: 10px auto 24px; max-width: 420px; font-size: 13px; color: var(--text-secondary); overflow-wrap: anywhere; }
.hot-primary { display: inline-block; background: var(--accent-red); color: #fff; border-radius: 9px; padding: 10px 22px; font-size: 13px; }
.hot-skeleton { display: flex; gap: 14px; padding: 12px; border: 1px solid var(--border-subtle); border-radius: 14px; height: 174px; background: #19191f; animation: breathe 1.3s infinite alternate; }
.hot-skeleton > i { width: 104px; height: 148px; border-radius: 8px; background: #2a2a32; flex: none; }
.hot-skeleton > div { flex: 1; padding-top: 16px; }
.hot-skeleton b { display: block; width: 90%; height: 12px; background: #2a2a32; border-radius: 3px; margin-bottom: 14px; }
.hot-skeleton b:last-child { width: 60%; }
@keyframes breathe { to { opacity: .45; } }
@media (max-width: 899px) {
  .hot-content { padding: calc(22px + env(safe-area-inset-top, 0px)) 16px 30px; }
  .hot-heading { padding-bottom: 22px; }
  h1 { font-size: 30px; }
  .hot-list { grid-template-columns: 1fr; gap: 12px; }
  .hot-card { padding: 12px; gap: 14px; }
  .hot-cover { flex-basis: 92px; height: 132px; }
  .hot-meta { font-size: 11px; }
  .ranking-label { margin-top: 22px; }
  .refresh-hot { padding: 9px 12px; }
}
@media (prefers-reduced-motion: reduce) { .hot-card { transition: none; } .hot-skeleton { animation: none; } }
</style>
