import type {
  Account,
  CommentItem,
  FeedVideoItem,
  ListLatestResp,
  ListPopularityRequest,
  ListPopularityResp,
  LoginResponse,
  MessageItem,
  SocialCounts,
  VideoItem
} from '@/types'

/**
 * Mock 数据层：与 realApi 完全同构，纯前端内存实现。
 * 用于后端未启动时的独立开发与演示；切真实后端只需 VITE_USE_MOCK=false。
 */

const delay = (ms = 250) => new Promise<void>((r) => setTimeout(r, ms))

const SELF_ID = 999

/* ---------------- 用户 ---------------- */
const users: Account[] = [
  { id: 101, username: 'mei.moves', avatar_url: 'https://i.pravatar.cc/150?u=101', bio: '用舞蹈记录生活 ✨' },
  { id: 102, username: 'citylights', avatar_url: 'https://i.pravatar.cc/150?u=102', bio: '城市夜景收藏家' },
  { id: 103, username: 'foodie阿福', avatar_url: 'https://i.pravatar.cc/150?u=103', bio: '深夜放毒专业户' },
  { id: 104, username: 'travel.leo', avatar_url: 'https://i.pravatar.cc/150?u=104', bio: '在路上 | 背包客' },
  { id: 105, username: 'codercat', avatar_url: 'https://i.pravatar.cc/150?u=105', bio: '写代码的猫' },
  { id: 106, username: 'music_luna', avatar_url: 'https://i.pravatar.cc/150?u=106', bio: '翻唱 | 原创demo' }
]

const self: Account = { id: SELF_ID, username: 'me', avatar_url: '', bio: '' }

const allUsers = new Map<number, Account>(users.map((u) => [u.id, u]))
allUsers.set(SELF_ID, self)

/* ---------------- 视频 ---------------- */
const SAMPLE_VIDEOS = [
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  'https://media.w3.org/2010/05/synthetic/trailer.mp4',
  'https://media.w3.org/2010/05/bunny/movie.mp4',
  'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4'
]

const TITLES = [
  '一支舞点亮夜色，跟着我跳进下一拍',
  '城市灯火通明的瞬间',
  '深夜食堂开张了',
  '背包客的第 42 个城市',
  '写代码累了看看这个',
  '翻唱一首晚安曲',
  '周末出逃计划',
  '这道菜我能吃三碗饭',
  '街角的浪漫',
  '今日份治愈',
  '把生活过成电影',
  '夜幕下的节奏'
]

const TAGS = ['#舞蹈挑战', '#CityLights', '#深夜放毒', '#旅行', '#程序员日常', '#翻唱']

const feed: FeedVideoItem[] = SAMPLE_VIDEOS.map((url, i) => {
  const author = users[i % users.length]
  return {
    id: i + 1,
    author: { id: author.id, username: author.username },
    title: TITLES[i],
    description: `${TITLES[i]} ✨ ${TAGS[i % TAGS.length]} ${TAGS[(i + 1) % TAGS.length]}`,
    play_url: url,
    cover_url: `https://picsum.photos/seed/dy${i + 1}/540/960`,
    create_time: Math.floor(Date.now() / 1000) - (i + 1) * 3600,
    likes_count: [128400, 936, 12800, 6208, 45200, 3300, 21000, 888, 56700, 1234, 9800, 456][i],
    is_liked: false
  }
})

const hotSnapshots = new Map<number, FeedVideoItem[]>()
let feedSeq = feed.length

/* ---------------- 关注 / 评论 / 私信 ---------------- */
const followingIds = new Set<number>([101, 104])
const followers: Account[] = [users[1], users[2], users[4]]

const commentsMap = new Map<number, CommentItem[]>()
let commentSeq = 0

const COMMENT_POOL = [
  '太棒了！',
  '第一！',
  '这也太好看了吧',
  '求教程',
  '已三连',
  '被治愈了',
  '循环了十遍',
  'up 主加油'
]

function seedComments(videoId: number): CommentItem[] {
  const n = 2 + (videoId % 4)
  const list: CommentItem[] = []
  for (let i = 0; i < n; i++) {
    const u = users[(videoId + i) % users.length]
    list.push({
      id: ++commentSeq,
      username: u.username,
      video_id: videoId,
      author_id: u.id,
      content: COMMENT_POOL[(videoId + i) % COMMENT_POOL.length],
      created_at: new Date(Date.now() - (i + 1) * 600000).toISOString()
    })
  }
  return list
}

const threads = new Map<number, MessageItem[]>()
let msgSeq = 0

function seedThread(peerId: number): MessageItem[] {
  return [
    {
      id: ++msgSeq,
      from_id: peerId,
      to_id: SELF_ID,
      content: '嗨，看到你的视频了，很棒！',
      is_read: true,
      created_at: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: ++msgSeq,
      from_id: SELF_ID,
      to_id: peerId,
      content: '谢谢支持～',
      is_read: true,
      created_at: new Date(Date.now() - 3500000).toISOString()
    }
  ]
}

/* ---------------- 工具 ---------------- */
function toVideoItem(v: FeedVideoItem): VideoItem {
  return {
    id: v.id,
    author_id: v.author.id,
    username: v.author.username,
    title: v.title,
    description: v.description,
    play_url: v.play_url,
    cover_url: v.cover_url,
    create_time: new Date(v.create_time * 1000).toISOString(),
    likes_count: v.likes_count,
    popularity: v.likes_count
  }
}

function paginate(list: FeedVideoItem[], limit: number, cursor: number): ListLatestResp {
  // mock 游标：0 表示第一页，之后为页号 * 1000000
  const page = cursor <= 0 ? 0 : Math.floor(cursor / 1000000)
  const start = page * limit
  const slice = list.slice(start, start + limit)
  const hasMore = start + limit < list.length
  return {
    video_list: slice,
    next_time: hasMore ? (page + 1) * 1000000 : 0,
    has_more: hasMore
  }
}

/* ---------------- Mock API（与 realApi 同构） ---------------- */
export const mockApi = {
  /* 账号 */
  register: async (_u: string, _p: string) => {
    await delay()
    return {}
  },

  login: async (username: string, _p: string): Promise<LoginResponse> => {
    await delay(400)
    self.username = username
    return {
      token: 'mock-token-' + Date.now(),
      refresh_token: 'mock-refresh-token',
      account_id: SELF_ID,
      username
    }
  },

  logout: async () => {
    await delay(100)
    return {}
  },

  findByID: async (id: number): Promise<Account> => {
    await delay(120)
    return allUsers.get(id) || { id, username: 'user' + id }
  },

  updateProfile: async (avatar_url: string, bio: string) => {
    await delay()
    self.avatar_url = avatar_url
    self.bio = bio
    return {}
  },

  uploadAvatar: async (file: File) => {
    await delay(300)
    return { avatar_url: URL.createObjectURL(file) }
  },

  /* Feed */
  feedLatest: async (limit: number, latest_time: number): Promise<ListLatestResp> => {
    await delay(350)
    return paginate(feed, limit, latest_time)
  },

  feedFollowing: async (limit: number, latest_time: number): Promise<ListLatestResp> => {
    await delay(350)
    return paginate(feed.filter((v) => followingIds.has(v.author.id)), limit, latest_time)
  },

  feedPopularity: async (request: ListPopularityRequest): Promise<ListPopularityResp> => {
    await delay(300)
    const asOf = request.as_of || Math.floor(Date.now() / 60000) * 60
    let snapshot = hotSnapshots.get(asOf)
    if (!snapshot) {
      snapshot = [...feed].sort((a, b) => b.likes_count - a.likes_count || b.create_time - a.create_time || b.id - a.id)
      hotSnapshots.set(asOf, snapshot)
      if (hotSnapshots.size > 4) hotSnapshots.delete(hotSnapshots.keys().next().value!)
    }
    const limit = Math.min(50, Math.max(1, request.limit))
    const offset = Math.max(0, request.offset)
    const items = snapshot.slice(offset, offset + limit)
    return { video_list: items.map(v => ({ ...v })), as_of: asOf, next_offset: offset + items.length, has_more: offset + items.length < snapshot.length }
  },

  /* 点赞 */
  like: async (video_id: number) => {
    await delay(120)
    return {}
  },
  unlike: async (video_id: number) => {
    await delay(120)
    return {}
  },
  myLikedVideos: async (): Promise<VideoItem[]> => {
    await delay()
    return feed.filter((v) => v.is_liked).map(toVideoItem)
  },

  /* 评论 */
  comments: async (video_id: number): Promise<CommentItem[]> => {
    await delay()
    if (!commentsMap.has(video_id)) commentsMap.set(video_id, seedComments(video_id))
    return commentsMap.get(video_id)!
  },

  publishComment: async (video_id: number, content: string) => {
    await delay()
    const list = commentsMap.get(video_id) || []
    const comment: CommentItem = {
      id: ++commentSeq,
      username: self.username,
      video_id,
      author_id: SELF_ID,
      content,
      created_at: new Date().toISOString()
    }
    list.unshift(comment)
    commentsMap.set(video_id, list)
    return { comment }
  },

  deleteComment: async (comment_id: number) => {
    await delay()
    for (const [vid, list] of commentsMap) {
      commentsMap.set(
        vid,
        list.filter((c) => c.id !== comment_id)
      )
    }
    return {}
  },

  /* 关注 */
  follow: async (vlogger_id: number) => {
    await delay(150)
    followingIds.add(vlogger_id)
    return {}
  },
  unfollow: async (vlogger_id: number) => {
    await delay(150)
    followingIds.delete(vlogger_id)
    return {}
  },
  myVloggers: async (): Promise<Account[]> => {
    await delay()
    return [...followingIds].map((id) => allUsers.get(id)!).filter(Boolean)
  },
  myFollowers: async (): Promise<Account[]> => {
    await delay()
    return followers
  },
  socialCounts: async (): Promise<SocialCounts> => {
    await delay(100)
    return { follower_count: followers.length, vlogger_count: followingIds.size }
  },

  /* 发布（本地 blob URL，仅本次会话可播） */
  uploadVideo: async (file: File, onProgress?: (p: number) => void) => {
    for (let p = 10; p <= 100; p += 18) {
      await delay(180)
      onProgress?.(Math.min(p, 100))
    }
    return { play_url: URL.createObjectURL(file) }
  },

  uploadCover: async (file: File) => {
    await delay(300)
    return { cover_url: URL.createObjectURL(file) }
  },

  publishVideo: async (payload: { title: string; description: string; play_url: string; cover_url: string }) => {
    await delay(300)
    feed.unshift({
      id: ++feedSeq,
      author: { id: SELF_ID, username: self.username },
      title: payload.title,
      description: payload.description,
      play_url: payload.play_url,
      cover_url: payload.cover_url,
      create_time: Math.floor(Date.now() / 1000),
      likes_count: 0,
      is_liked: false
    })
    return {}
  },

  videosByAuthor: async (author_id: number): Promise<VideoItem[]> => {
    await delay()
    return feed.filter((v) => v.author.id === author_id).map(toVideoItem)
  },

  /* 私信 */
  messages: async (peer_id: number) => {
    await delay()
    if (!threads.has(peer_id)) threads.set(peer_id, seedThread(peer_id))
    return { messages: threads.get(peer_id)! }
  },

  sendMessage: async (to_id: number, content: string) => {
    await delay(150)
    const list = threads.get(to_id) || []
    list.push({
      id: ++msgSeq,
      from_id: SELF_ID,
      to_id,
      content,
      is_read: true,
      created_at: new Date().toISOString()
    })
    threads.set(to_id, list)
    return {}
  }
}
