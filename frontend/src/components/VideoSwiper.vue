<template>
  <div ref="el" class="feed-swiper" @scroll.passive="onScroll">
    <section v-for="(v, i) in videos" :key="v.id" class="feed-slide">
      <!-- 仅渲染当前项前后 1 屏，之外用占位保持滚动高度 -->
      <VideoItem
        v-if="Math.abs(i - activeIndex) <= 1"
        :video="v"
        :active="i === activeIndex"
        :near="Math.abs(i - activeIndex) <= 1"
        @open-comments="$emit('open-comments', $event)"
      />
    </section>
    <div v-if="loading" class="feed-tip">加载中…</div>
    <div v-else-if="!hasMore && videos.length" class="feed-tip">— 到底啦 —</div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onBeforeUnmount, onDeactivated, ref, watch } from 'vue'
import VideoItem from './VideoItem.vue'
import type { FeedVideoItem } from '@/types'

/**
 * 竖向视频流：原生 scroll-snap 驱动（移动端惯性/回弹免费获得），
 * 只挂载 active±1 三个视频节点，离开视口的 video 被卸载释放内存。
 */
const props = defineProps<{
  videos: FeedVideoItem[]
  activeIndex: number
  loading: boolean
  hasMore: boolean
}>()

const emit = defineEmits<{
  'update:activeIndex': [number]
  loadmore: []
  'open-comments': [FeedVideoItem]
}>()

const el = ref<HTMLElement>()
let scrollTimer: ReturnType<typeof setTimeout> | null = null

function onScroll() {
  // 滚动停止后再切换 active，避免中途触发播放/暂停抖动
  if (scrollTimer) clearTimeout(scrollTimer)
  scrollTimer = setTimeout(() => {
    const node = el.value
    if (!node || node.clientHeight === 0) return
    const idx = Math.max(0, Math.min(props.videos.length - 1, Math.round(node.scrollTop / node.clientHeight)))
    if (idx !== props.activeIndex && idx < props.videos.length) {
      emit('update:activeIndex', idx)
    }
    if (!props.loading && props.hasMore && idx >= props.videos.length - 3) {
      emit('loadmore')
    }
  }, 80)
}

// Tab 各自保存索引，挂载/切换时同步实际滚动位置。
function syncPosition() {
  nextTick(() => {
    const node = el.value
    if (node) node.scrollTop = props.activeIndex * node.clientHeight
  })
}
onMounted(() => {
  syncPosition()
  if (!props.loading && props.hasMore && props.activeIndex >= props.videos.length - 3) emit('loadmore')
})
watch(() => props.videos, syncPosition)
watch(() => props.activeIndex, syncPosition)
watch(() => props.loading, loading => {
  if (!loading && props.hasMore && props.activeIndex >= props.videos.length - 3) emit('loadmore')
})
function clearScrollTimer() {
  if (scrollTimer) clearTimeout(scrollTimer)
  scrollTimer = null
}
onBeforeUnmount(clearScrollTimer)
onDeactivated(clearScrollTimer)

defineExpose({
  scrollTo(index: number) {
    const node = el.value
    if (node) node.scrollTo({ top: index * node.clientHeight })
  }
})
</script>

<style scoped>
.feed-swiper {
  height: 100%;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  scrollbar-width: none;
  background: #000;
}

.feed-swiper::-webkit-scrollbar {
  display: none;
}

.feed-slide {
  height: 100%;
  scroll-snap-align: start;
  scroll-snap-stop: always;
  position: relative;
}

.feed-tip {
  padding: 24px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
  scroll-snap-align: start;
}

/* 桌面端：视频列居中，滚轮可直接翻页 */
@media (min-width: 900px) {
  .feed-swiper {
    max-width: 480px;
    margin: 0 auto;
    border-left: 0.5px solid var(--border-subtle);
    border-right: 0.5px solid var(--border-subtle);
  }
}
</style>
