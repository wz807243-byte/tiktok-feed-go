import http from './http'
import type {
  Account,
  CommentItem,
  ListLatestResp,
  ListPopularityRequest,
  ListPopularityResp,
  LoginResponse,
  MessageItem,
  SocialCounts,
  VideoItem
} from '@/types'

/** feedsystem-go 真实后端接口（除静态资源外均为 POST + JSON） */
export const realApi = {
  /* ---------- 账号 ---------- */
  register: (username: string, password: string) =>
    http.post('/account/register', { username, password }),

  login: (username: string, password: string) =>
    http.post<LoginResponse>('/account/login', { username, password }).then((r) => r.data),

  logout: () => http.post('/account/logout'),

  findByID: (id: number) => http.post<Account>('/account/findByID', { id }).then((r) => r.data),

  updateProfile: (avatar_url: string, bio: string) =>
    http.post('/account/profile', { avatar_url, bio }),

  uploadAvatar: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return http.post<{ avatar_url: string }>('/account/avatar', fd, { timeout: 120000 }).then((r) => r.data)
  },

  /* ---------- Feed 流 ---------- */
  feedLatest: (limit: number, latest_time: number) =>
    http.post<ListLatestResp>('/feed/listLatest', { limit, latest_time }).then((r) => r.data),

  feedFollowing: (limit: number, latest_time: number) =>
    http.post<ListLatestResp>('/feed/listByFollowing', { limit, latest_time }).then((r) => r.data),

  feedPopularity: (payload: ListPopularityRequest) =>
    http.post<ListPopularityResp>('/feed/listByPopularity', payload).then((r) => r.data),

  /* ---------- 点赞 ---------- */
  like: (video_id: number) => http.post('/like/like', { video_id }),
  unlike: (video_id: number) => http.post('/like/unlike', { video_id }),
  myLikedVideos: () => http.post<VideoItem[]>('/like/listMyLikedVideos', {}).then((r) => r.data),

  /* ---------- 评论 ---------- */
  comments: (video_id: number) =>
    http.post<CommentItem[]>('/comment/listAll', { video_id }).then((r) => r.data),

  publishComment: (video_id: number, content: string) =>
    http.post<{ comment: CommentItem }>('/comment/publish', { video_id, content }).then((r) => r.data),

  deleteComment: (comment_id: number) => http.post('/comment/delete', { comment_id }),

  /* ---------- 关注 ---------- */
  follow: (vlogger_id: number) => http.post('/social/follow', { vlogger_id }),
  unfollow: (vlogger_id: number) => http.post('/social/unfollow', { vlogger_id }),
  myVloggers: () => http.post<Account[]>('/social/getAllVloggers', {}).then((r) => r.data),
  myFollowers: () => http.post<Account[]>('/social/getAllFollowers', {}).then((r) => r.data),
  socialCounts: () => http.post<SocialCounts>('/social/getCounts', {}).then((r) => r.data),

  /* ---------- 视频发布 ---------- */
  uploadVideo: (file: File, onProgress?: (percent: number) => void) => {
    const fd = new FormData()
    fd.append('file', file)
    return http
      .post<{ play_url: string }>('/video/uploadVideo', fd, {
        timeout: 600000,
        onUploadProgress: (e) => {
          if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
        }
      })
      .then((r) => r.data)
  },

  uploadCover: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return http.post<{ cover_url: string }>('/video/uploadCover', fd, { timeout: 120000 }).then((r) => r.data)
  },

  publishVideo: (payload: { title: string; description: string; play_url: string; cover_url: string }) =>
    http.post('/video/publish', payload),

  videosByAuthor: (author_id: number) =>
    http.post<VideoItem[]>('/video/listByAuthorID', { author_id }).then((r) => r.data),

  /* ---------- 私信 ---------- */
  messages: (peer_id: number) =>
    http.post<{ messages: MessageItem[] }>('/message/list', { peer_id }).then((r) => r.data),

  sendMessage: (to_id: number, content: string) => http.post('/message/send', { to_id, content })
}
