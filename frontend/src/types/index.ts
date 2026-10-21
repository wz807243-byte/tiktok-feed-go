/** 与 feedsystem-go 后端对齐的类型定义 */

export interface FeedAuthor {
  id: number
  username: string
}

/** /feed 系列接口返回的视频条目（create_time 为秒级时间戳） */
export interface FeedVideoItem {
  id: number
  author: FeedAuthor
  title: string
  description?: string
  play_url: string
  cover_url: string
  create_time: number
  likes_count: number
  is_liked: boolean
}

/** /video/listByAuthorID、/like/listMyLikedVideos 返回的视频（create_time 为 RFC3339） */
export interface VideoItem {
  id: number
  author_id: number
  username: string
  title: string
  description?: string
  play_url: string
  cover_url: string
  create_time: string
  likes_count: number
  popularity: number
}

export interface Account {
  id: number
  username: string
  avatar_url?: string
  bio?: string
}

export interface LoginResponse {
  token: string
  refresh_token: string
  account_id: number
  username: string
}

export interface ListLatestResp {
  video_list: FeedVideoItem[] | null
  next_time: number
  has_more: boolean
}

export interface CommentItem {
  id: number
  username: string
  video_id: number
  author_id: number
  content: string
  created_at: string
}

export interface MessageItem {
  id: number
  from_id: number
  to_id: number
  content: string
  is_read: boolean
  created_at: string
}

export interface SocialCounts {
  follower_count: number
  vlogger_count: number
}

/** 热度榜同时兼容 Redis 快照和数据库游标分页。 */
export interface ListPopularityRequest {
  limit: number
  as_of: number
  offset: number
  latest_popularity?: number
  latest_before?: string
  latest_id_before?: number
}

export interface ListPopularityResp {
  video_list: FeedVideoItem[] | null
  as_of: number
  next_offset: number
  has_more: boolean
  next_latest_popularity?: number | null
  next_latest_before?: string | null
  next_latest_id_before?: number | null
}
