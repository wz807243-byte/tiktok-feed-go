<template>
  <div class="video-info">
    <div class="author">
      <span class="name">@{{ video.author.username }}</span>
      <svg v-if="false" class="badge" viewBox="0 0 24 24" width="14" height="14"><!-- 后端无认证字段，预留 --></svg>
    </div>
    <p class="desc" :class="{ collapsed: !expanded }" @click="expanded = !expanded">
      <span class="title">{{ video.title }}</span>
      <span v-if="video.description"> {{ video.description }}</span>
    </p>
    <div class="music">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
        <path d="M9 18.5A2.5 2.5 0 1 1 6.5 16c.5 0 1 .1 1.5.4V4l11-2v13.5a2.5 2.5 0 1 1-2-2.45V6.3l-8 1.45z" />
      </svg>
      <div class="marquee">
        <span class="track">原声 · {{ video.author.username }} · {{ video.title }}&nbsp;&nbsp;&nbsp;</span>
        <span class="track" aria-hidden="true">原声 · {{ video.author.username }} · {{ video.title }}&nbsp;&nbsp;&nbsp;</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { FeedVideoItem } from '@/types'

defineProps<{ video: FeedVideoItem }>()
const expanded = ref(false)
</script>

<style scoped>
.video-info {
  color: #fff;
  font-size: 14px;
}

.author {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
}

.desc {
  cursor: pointer;
  line-height: 1.45;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  margin-bottom: 8px;
  word-break: break-all;
}

.desc.collapsed {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.music {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 70%;
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
}

.marquee {
  overflow: hidden;
  white-space: nowrap;
  flex: 1;
  mask-image: linear-gradient(90deg, #000 85%, transparent);
}

.track {
  display: inline-block;
  animation: scroll 9s linear infinite;
}

@keyframes scroll {
  to {
    transform: translateX(-100%);
  }
}
</style>
