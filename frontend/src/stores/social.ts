import { defineStore } from 'pinia'
import { api } from '@/api'

/**
 * 关注关系：后端没有"是否已关注某作者"的查询接口，
 * 登录后拉一次"我关注的人"缓存成集合，关注/取关走乐观更新。
 */
export const useSocialStore = defineStore('social', {
  state: () => ({
    followingIds: [] as number[],
    loaded: false,
    pendingChanges: 0
  }),
  actions: {
    isFollowing(id: number) {
      return this.followingIds.includes(id)
    },
    async loadFollowing(force = false) {
      if (this.loaded && !force) return
      try {
        const list = await api.myVloggers()
        this.followingIds = (list || []).map((a) => a.id)
        this.loaded = true
      } catch {
        /* 未登录或网络失败时静默 */
      }
    },
    async toggleFollow(id: number) {
      const idx = this.followingIds.indexOf(id)
      const wasFollowing = idx >= 0
      this.pendingChanges++
      // 乐观更新
      if (wasFollowing) this.followingIds.splice(idx, 1)
      else this.followingIds.push(id)
      try {
        if (wasFollowing) await api.unfollow(id)
        else await api.follow(id)
      } catch (e) {
        // 回滚
        if (wasFollowing) {
          if (!this.followingIds.includes(id)) this.followingIds.push(id)
        } else {
          const currentIndex = this.followingIds.indexOf(id)
          if (currentIndex >= 0) this.followingIds.splice(currentIndex, 1)
        }
        throw e
      } finally {
        this.pendingChanges = Math.max(0, this.pendingChanges - 1)
      }
    }
  }
})
