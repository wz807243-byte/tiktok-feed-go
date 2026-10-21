<template>
  <div class="video-item" @pointerup="onTap">
    <video
      ref="vid"
      class="player"
      :poster="video.cover_url"
      playsinline
      webkit-playsinline
      x5-video-player-type="h5-page"
      muted
      loop
      preload="metadata"
      @play="paused = false"
      @pause="paused = true"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onMeta"
    ></video>

    <!-- 暂停态大播放键 -->
    <transition name="fade">
      <div v-if="paused && active" class="pause-icon">
        <svg viewBox="0 0 24 24" width="64" height="64" fill="rgba(255,255,255,0.85)">
          <path d="M8 5.5v13l11-6.5z" />
        </svg>
      </div>
    </transition>

    <!-- 双击飘心层 -->
    <span
      v-for="h in hearts"
      :key="h.id"
      class="burst-heart"
      :style="{ left: h.x + 'px', top: h.y + 'px', '--rot': h.rot + 'deg' }"
    >
      <svg viewBox="0 0 24 24" width="72" height="72" fill="#fe2c55">
        <path d="M12 21c-4.8-3.9-9-7.2-9-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 3.8-4.2 7.1-9 11z" />
      </svg>
    </span>

    <!-- 底部信息遮罩 + 信息区 + 侧栏 -->
    <div class="bottom-mask"></div>
    <VideoInfo :video="video" class="info" />
    <SideActionBar :video="video" :active="active" class="side" @open-comments="$emit('open-comments', video)" />

    <!-- 播放进度条 -->
    <div class="progress"><i :style="{ width: progress + '%' }"></i></div>
  </div>
</template>

<script setup lang="ts">
import { onActivated, onDeactivated, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import VideoInfo from './VideoInfo.vue'
import SideActionBar from './SideActionBar.vue'
import { useLike } from '@/composables/useLike'
import type { FeedVideoItem } from '@/types'

const props = defineProps<{
  video: FeedVideoItem
  active: boolean
  /** 距当前项 <=1，用于决定是否挂载 src 预加载 */
  near: boolean
}>()

defineEmits<{ 'open-comments': [FeedVideoItem] }>()

const vid = ref<HTMLVideoElement>()
const paused = ref(true)
const progress = ref(0)
const duration = ref(0)
const hearts = ref<{ id: number; x: number; y: number; rot: number }[]>([])
let heartSeq = 0

const { toggleLike } = useLike()

const visible = ref(true)
function syncPlayback() {
  const player = vid.value
  if (!player) return
  if (props.near && player.getAttribute('src') !== props.video.play_url) player.src = props.video.play_url
  if (visible.value && props.active) player.play().catch(() => {})
  else player.pause()
}
onMounted(syncPlayback)
watch([() => props.active, () => props.near, () => props.video.play_url, visible], syncPlayback, { flush: 'post' })
onActivated(() => { visible.value = true; syncPlayback() })
onDeactivated(() => { visible.value = false; vid.value?.pause() })
onBeforeUnmount(() => {
  if (singleTimer) clearTimeout(singleTimer)
  const player = vid.value
  if (player) { player.pause(); player.removeAttribute('src'); player.load() }
})

function onMeta() {
  duration.value = vid.value?.duration || 0
}

function onTimeUpdate() {
  const el = vid.value
  if (el && el.duration) progress.value = (el.currentTime / el.duration) * 100
}

/* 单击/双击识别：280ms 内第二次点击视为双击 */
let lastTap = 0
let singleTimer: ReturnType<typeof setTimeout> | null = null

function onTap(e: PointerEvent) {
  if ((e.target as HTMLElement).closest('button, a, input, textarea')) return
  const now = Date.now()
  if (now - lastTap < 280) {
    // 双击：飘心 + 点赞（已点赞仅飘心）
    if (singleTimer) {
      clearTimeout(singleTimer)
      singleTimer = null
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const id = ++heartSeq
    hearts.value.push({
      id,
      x: e.clientX - rect.left - 36,
      y: e.clientY - rect.top - 36,
      rot: Math.round(Math.random() * 40 - 20)
    })
    setTimeout(() => {
      hearts.value = hearts.value.filter((h) => h.id !== id)
    }, 900)
    toggleLike(props.video, true)
    lastTap = 0
  } else {
    lastTap = now
    singleTimer = setTimeout(() => {
      const el = vid.value
      if (!el) return
      if (el.paused) el.play().catch(() => {})
      else el.pause()
      singleTimer = null
    }, 280)
  }
}
</script>

<style scoped>
.video-item {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  overflow: hidden;
}

.player {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pause-icon {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.burst-heart {
  position: absolute;
  pointer-events: none;
  animation: burst 0.9s ease-out forwards;
}

@keyframes burst {
  0% {
    opacity: 0;
    transform: scale(0.3) rotate(var(--rot));
  }
  20% {
    opacity: 1;
    transform: scale(1.1) rotate(var(--rot));
  }
  100% {
    opacity: 0;
    transform: scale(0.9) rotate(var(--rot)) translateY(-90px);
  }
}

.bottom-mask {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 220px;
  background: var(--mask-bottom);
  pointer-events: none;
}

.info {
  position: absolute;
  left: 12px;
  right: 92px;
  bottom: 12px;
  z-index: 5;
}

.side {
  position: absolute;
  right: 8px;
  bottom: 60px;
  z-index: 5;
}

.progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  background: rgba(255, 255, 255, 0.15);
  z-index: 6;
}

.progress i {
  display: block;
  height: 100%;
  background: #fff;
  transition: width 0.2s linear;
}
</style>
