import { realApi } from './real'
import { mockApi } from './mock'
import { USE_MOCK } from './config'

export { USE_MOCK } from './config'
export const api = (USE_MOCK ? mockApi : realApi) as typeof realApi
export type { FeedVideoItem } from '@/types'
