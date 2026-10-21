import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { reactive } from 'vue'
import { API_BASE_URL, USE_MOCK } from './config'
import type { LoginResponse } from '@/types'

// 隔离 Mock 凭证，防止演示登录污染真实账号会话。
const prefix = USE_MOCK ? 'douyin.mock.' : 'douyin.real.'
export const LS_KEYS = {
  token: prefix + 'token', refreshToken: prefix + 'refresh_token',
  accountId: prefix + 'account_id', username: prefix + 'username'
} as const

export const session = reactive({
  token: localStorage.getItem(LS_KEYS.token) || '',
  accountId: Number(localStorage.getItem(LS_KEYS.accountId)) || 0,
  username: localStorage.getItem(LS_KEYS.username) || ''
})

export function saveCredentials(data: LoginResponse) {
  localStorage.setItem(LS_KEYS.token, data.token)
  localStorage.setItem(LS_KEYS.refreshToken, data.refresh_token)
  localStorage.setItem(LS_KEYS.accountId, String(data.account_id))
  localStorage.setItem(LS_KEYS.username, data.username)
  Object.assign(session, { token: data.token, accountId: data.account_id, username: data.username })
}

export function clearCredentials() {
  Object.values(LS_KEYS).forEach(k => localStorage.removeItem(k))
  Object.assign(session, { token: '', accountId: 0, username: '' })
}

// Keep locally uploaded media portable when the frontend port changes.
function normalizeStaticMedia(data: unknown): void {
  if (!data || typeof data !== 'object') return
  if (Array.isArray(data)) { data.forEach(normalizeStaticMedia); return }
  const record = data as Record<string, unknown>
  for (const [key, value] of Object.entries(record)) {
    if (['play_url', 'cover_url', 'avatar_url'].includes(key) && typeof value === 'string') {
      try {
        const url = new URL(value)
        if (['http:', 'https:'].includes(url.protocol) && ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(url.hostname) && url.pathname.startsWith('/static/')) {
          record[key] = url.pathname + url.search + url.hash
        }
      } catch { /* Existing relative paths are already portable. */ }
    } else normalizeStaticMedia(value)
  }
}

const http = axios.create({ baseURL: API_BASE_URL, timeout: 30000 })
const refreshHttp = axios.create({ baseURL: API_BASE_URL, timeout: 15000 })
const isAuthEndpoint = (url = '') => /\/account\/(login|register|refresh)(?:[?#]|$)/.test(url)

http.interceptors.request.use(config => {
  const request = config as InternalAxiosRequestConfig & { _session?: string | null }
  if (!('_session' in request)) request._session = localStorage.getItem(LS_KEYS.refreshToken)
  const token = session.token
  if (token && !isAuthEndpoint(config.url)) config.headers.Authorization = 'Bearer ' + token
  return config
})

class SessionExpiredError extends Error {}
let refreshing: Promise<string> | null = null

async function doRefresh(): Promise<string> {
  const rt = localStorage.getItem(LS_KEYS.refreshToken)
  if (!rt) throw new SessionExpiredError('登录已过期，请重新登录')
  const { data } = await refreshHttp.post('/account/refresh', { refresh_token: rt })
  // 退出或切换账号后，旧请求不能恢复之前的会话。
  if (localStorage.getItem(LS_KEYS.refreshToken) !== rt) throw new Error('登录状态已变化')
  if (typeof data?.token !== 'string' || !data.token || !data.account_id || typeof data.username !== 'string') {
    throw new SessionExpiredError('登录续期响应无效，请重新登录')
  }
  saveCredentials({ ...data, refresh_token: data.refresh_token || rt })
  return data.token
}

function expireSession(expectedToken: string) {
  if (session.token !== expectedToken) return
  clearCredentials()
  if (window.location.pathname !== '/login') {
    const redirect = window.location.pathname + window.location.search + window.location.hash
    window.location.assign('/login?redirect=' + encodeURIComponent(redirect))
  }
}

http.interceptors.response.use(resp => { normalizeStaticMedia(resp.data); return resp }, async (error: AxiosError) => {
  const config = error.config as (InternalAxiosRequestConfig & { _retried?: boolean; _session?: string | null }) | undefined
  if (error.response?.status !== 401 || !config || isAuthEndpoint(config.url)) return Promise.reject(error)
  const sentToken = String(config.headers.Authorization || '').replace(/^Bearer /i, '')
  if (!sentToken || config._session !== localStorage.getItem(LS_KEYS.refreshToken)) return Promise.reject(error)
  if (config._retried) {
    expireSession(sentToken)
    return Promise.reject(error)
  }
  config._retried = true
  try {
    // 并发请求中迟到的 401，直接使用已经刷新的令牌。
    if (session.token && session.token !== sentToken) {
      config.headers.Authorization = 'Bearer ' + session.token
    } else {
      refreshing ??= doRefresh().finally(() => { refreshing = null })
      config.headers.Authorization = 'Bearer ' + await refreshing
    }
  } catch (refreshError) {
    const status = axios.isAxiosError(refreshError) ? refreshError.response?.status : undefined
    if (refreshError instanceof SessionExpiredError || status === 400 || status === 401 || status === 403) {
      expireSession(sentToken)
    }
    return Promise.reject(refreshError)
  }
  return http(config)
})

export function errMsg(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data
    if (data && typeof data === 'object') {
      // 兼容当前 Go 登录接口的多种错误字段。
      for (const key of ['error', 'account error', 'accessToken, refreshToken error']) {
        if (typeof data[key] === 'string') {
          const message = data[key] as string
          if (/Duplicate entry/i.test(message) && /username/i.test(message)) return '用户名已存在，请直接登录或更换用户名'
          if (error.config?.url === '/account/login' && /hashedPassword|record not found/i.test(message)) return '用户名或密码错误'
          return message
        }
      }
    }
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') return '请求超时，请稍后重试'
    if (!error.response || [502, 503, 504].includes(error.response.status)) return '无法连接后端服务，请确认服务已启动'
    if (error.response.status === 404) return '请求接口不存在，请确认后端服务版本'
    if (error.response.status === 401) return '登录已过期，请重新登录'
  }
  if (error instanceof Error && !axios.isAxiosError(error)) return error.message
  return '操作失败，请稍后重试'
}

export default http
