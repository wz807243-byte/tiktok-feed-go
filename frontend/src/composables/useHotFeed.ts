import { onBeforeUnmount, ref } from 'vue'
import { api } from '@/api'
import { errMsg } from '@/api/http'
import type { FeedVideoItem, ListPopularityRequest, ListPopularityResp } from '@/types'

const firstPage = (): ListPopularityRequest => ({ limit: 12, as_of: 0, offset: 0 })

export function nextHotPage(previous: ListPopularityRequest, response: ListPopularityResp): ListPopularityRequest | null {
  if (!response.has_more) return null
  const next: ListPopularityRequest = { limit: previous.limit, as_of: response.as_of, offset: response.next_offset }
  if (typeof response.next_latest_popularity === 'number' && response.next_latest_before && response.next_latest_id_before) {
    next.latest_popularity = response.next_latest_popularity
    next.latest_before = response.next_latest_before
    next.latest_id_before = response.next_latest_id_before
  }
  if (next.as_of > 0) {
    if (next.offset <= 0 || (next.as_of === previous.as_of && next.offset <= previous.offset)) return null
  } else if (!next.latest_before || !next.latest_id_before ||
    (next.latest_before === previous.latest_before && next.latest_id_before === previous.latest_id_before && next.latest_popularity === previous.latest_popularity)) return null
  return next
}

export function useHotFeed(fetchPage: (request: ListPopularityRequest) => Promise<ListPopularityResp> = api.feedPopularity) {
  const videos = ref<FeedVideoItem[]>([])
  const loading = ref(false)
  const error = ref('')
  const hasMore = ref(true)
  const updatedAt = ref(0)
  let request = firstPage()
  let generation = 0

  async function loadMore() {
    if (loading.value || !hasMore.value) return
    const currentGeneration = generation
    loading.value = true
    error.value = ''
    try {
      const response = await fetchPage({ ...request })
      if (generation !== currentGeneration) return
      const seen = new Set(videos.value.map(video => video.id))
      const items = (response.video_list || []).filter(video => {
        if (seen.has(video.id)) return false
        seen.add(video.id)
        return true
      })
      videos.value.push(...items)
      const next = response.video_list?.length ? nextHotPage(request, response) : null
      if (response.video_list?.length && response.has_more && !next) throw new Error('榜单暂时无法继续加载，请刷新榜单')
      hasMore.value = !!next
      if (next) request = next
      updatedAt.value = Date.now()
    } catch (reason) {
      if (generation === currentGeneration) error.value = errMsg(reason)
    } finally { if (generation === currentGeneration) loading.value = false }
  }

  function refresh() {
    generation++
    videos.value = []
    loading.value = false
    error.value = ''
    hasMore.value = true
    updatedAt.value = 0
    request = firstPage()
    return loadMore()
  }
  onBeforeUnmount(() => { generation++ })
  return { videos, loading, error, hasMore, updatedAt, loadMore, refresh }
}
