/** Mock 必须显式启用；真实请求通过同源 /api 代理。 */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
