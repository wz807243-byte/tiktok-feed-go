import { defineStore } from 'pinia'
import { api } from '@/api'
import type { Account } from '@/types'

/**
 * Feed 条目没有作者头像/评论数，需要二次请求补齐。
 * 这里做两级缓存：用户资料 + 评论计数，避免重复请求。
 */
export const useMetaStore = defineStore('meta', {
  state: () => ({
    users: {} as Record<number, Account>,
    commentCounts: {} as Record<number, number>
  }),
  actions: {
    async getUser(id: number): Promise<Account | null> {
      if (this.users[id]) return this.users[id]
      try {
        const a = await api.findByID(id)
        this.users[id] = a
        return a
      } catch {
        return null
      }
    },
    async loadCommentCount(videoId: number) {
      if (this.commentCounts[videoId] !== undefined) return
      try {
        const list = await api.comments(videoId)
        this.commentCounts[videoId] = (list || []).length
      } catch {
        /* 忽略，侧栏先显示"评论" */
      }
    },
    setCommentCount(videoId: number, n: number) {
      this.commentCounts[videoId] = n
    }
  }
})
