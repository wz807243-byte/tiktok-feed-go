<template>
  <aside class="side-bar">
    <!-- 作者头像 + 关注 -->
    <div class="avatar-wrap">
      <div class="avatar">
        <img v-if="author?.avatar_url" :src="author.avatar_url" alt="" />
        <span v-else>{{ video.author.username.slice(0, 1).toUpperCase() }}</span>
      </div>
      <button v-if="showFollow" class="follow-badge" :class="{ followed: isFollowing }" :aria-label="isFollowing ? '取消关注' : '关注'" :disabled="followBusy" @click.stop="onFollow">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#fff" stroke-width="3">
          <path v-if="isFollowing" d="m5 12 4 4L19 6" stroke-linecap="round" stroke-linejoin="round" />
          <path v-else d="M12 5v14M5 12h14" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <!-- 点赞 -->
    <button class="action" @click.stop="onLike">
      <svg viewBox="0 0 24 24" width="34" height="34" :fill="video.is_liked ? '#fe2c55' : '#fff'">
        <path d="M12 21c-4.8-3.9-9-7.2-9-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 3.8-4.2 7.1-9 11z" />
      </svg>
      <span>{{ formatCount(video.likes_count) }}</span>
    </button>

    <!-- 评论 -->
    <button class="action" @click.stop="$emit('open-comments')">
      <svg viewBox="0 0 24 24" width="33" height="33" fill="#fff">
        <path d="M12 3C6.5 3 2 6.9 2 11.8c0 2.7 1.4 5.1 3.7 6.7-.2 1-.7 2.3-1.7 3.5 1.9-.1 3.6-.9 4.8-1.8 1 .3 2.1.4 3.2.4 5.5 0 10-3.9 10-8.8S17.5 3 12 3z" />
      </svg>
      <span>{{ commentCount !== undefined ? formatCount(commentCount) : '评论' }}</span>
    </button>

    <!-- 收藏（后端暂无接口） -->
    <button class="action" @click.stop="toast('收藏功能后端未开放')">
      <svg viewBox="0 0 24 24" width="32" height="32" fill="#fff">
        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z" />
      </svg>
      <span>收藏</span>
    </button>

    <!-- 分享 -->
    <button class="action" @click.stop="onShare">
      <svg viewBox="0 0 24 24" width="33" height="33" fill="#fff">
        <path d="M14 4l8 7-8 7v-4.2C8 13.4 4.5 15.5 2 19c0-6 4-10.5 12-11z" />
      </svg>
      <span>分享</span>
    </button>

    <!-- 音乐转盘 -->
    <div class="disc" :class="{ spinning: active }">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="#fff">
        <path d="M9 18.5A2.5 2.5 0 1 1 6.5 16c.5 0 1 .1 1.5.4V4l11-2v13.5a2.5 2.5 0 1 1-2-2.45V6.3l-8 1.45z" />
      </svg>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useSocialStore } from '@/stores/social'
import { useMetaStore } from '@/stores/meta'
import { useLike } from '@/composables/useLike'
import { formatCount } from '@/utils/format'
import { toast } from '@/utils/toast'
import type { Account, FeedVideoItem } from '@/types'

const props = defineProps<{ video: FeedVideoItem; active: boolean }>()
defineEmits<{ 'open-comments': [] }>()

const auth = useAuthStore()
const social = useSocialStore()
const meta = useMetaStore()
const { toggleLike } = useLike()

const author = ref<Account | null>(null)
const followBusy = ref(false)

const showFollow = computed(
  () =>
    auth.isLoggedIn &&
    props.video.author.id !== auth.accountId
)

const isFollowing = computed(() => social.isFollowing(props.video.author.id))

const commentCount = computed(() => meta.commentCounts[props.video.id])

// 成为当前视频时才补拉作者资料 / 评论数 / 关注集合
watch(
  () => props.active,
  async (a) => {
    if (!a) return
    meta.getUser(props.video.author.id).then((u) => (author.value = u))
    meta.loadCommentCount(props.video.id)
    if (auth.isLoggedIn) social.loadFollowing()
  },
  { immediate: true }
)

async function onLike() {
  await toggleLike(props.video)
}

async function onFollow() {
  if (followBusy.value) return
  const wasFollowing = isFollowing.value
  followBusy.value = true
  try {
    await social.toggleFollow(props.video.author.id)
    toast(wasFollowing ? '已取消关注' : `已关注 @${props.video.author.username}`)
  } catch {
    toast(wasFollowing ? '取消关注失败' : '关注失败')
  } finally {
    followBusy.value = false
  }
}

async function onShare() {
  const link = `${location.origin}/feed?video=${props.video.id}&author=${props.video.author.id}`
  try {
    await navigator.clipboard.writeText(link)
    toast('链接已复制')
  } catch {
    toast(link)
  }
}
</script>

<style scoped>
.side-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

.avatar-wrap {
  position: relative;
  margin-bottom: 6px;
}

.avatar {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: 1.5px solid #fff;
  background: #2c2c32;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.follow-badge {
  position: absolute;
  left: 50%;
  bottom: -9px;
  transform: translateX(-50%);
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent-red);
  display: flex;
  align-items: center;
  justify-content: center;
}

.follow-badge.followed { background: #555; }
.follow-badge:disabled { opacity: 0.65; }

.action {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}

.action svg {
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
}

.action:active svg {
  transform: scale(0.88);
}

.action svg {
  transition: transform 0.12s;
}

.disc {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #2c2c2a;
  border: 5px solid #1a1a1c;
  outline: 1px solid rgba(255, 255, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
}

.disc.spinning {
  animation: spin 4s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
