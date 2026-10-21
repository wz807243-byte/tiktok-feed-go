import { useAuthStore } from '@/stores/auth'
import { api } from '@/api'
import { toast } from '@/utils/toast'
import type { FeedVideoItem } from '@/types'

/**
 * 点赞逻辑（Feed 条目是 Pinia 外的响应式对象，直接改字段即可驱动视图）：
 * - 乐观更新，失败回滚
 * - 后端响应不含最新计数，本地 +1/-1
 * - 双击时若已点赞只飘心，不取关（抖音交互惯例）
 */
export function useLike() {
  const auth = useAuthStore()

  async function toggleLike(video: FeedVideoItem, fromDoubleTap = false): Promise<boolean> {
    if (!auth.isLoggedIn) {
      toast('登录后才能点赞')
      return false
    }
    if (video.is_liked) {
      if (fromDoubleTap) return true // 已点赞：仅飘心
      video.is_liked = false
      video.likes_count = Math.max(0, video.likes_count - 1)
      try {
        await api.unlike(video.id)
      } catch {
        video.is_liked = true
        video.likes_count += 1
        toast('操作失败')
      }
      return false
    }
    video.is_liked = true
    video.likes_count += 1
    try {
      await api.like(video.id)
    } catch {
      video.is_liked = false
      video.likes_count = Math.max(0, video.likes_count - 1)
      toast('操作失败')
      return false
    }
    return true
  }

  return { toggleLike }
}
