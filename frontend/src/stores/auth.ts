import { defineStore } from 'pinia'
import { computed, toRefs } from 'vue'
import { api } from '@/api'
import { session, saveCredentials, clearCredentials } from '@/api/http'
import type { LoginResponse } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const { token, accountId, username } = toRefs(session)
  const isLoggedIn = computed(() => !!token.value && !!accountId.value)
  function setSession(data: LoginResponse) { saveCredentials(data) }
  async function login(name: string, password: string) { setSession(await api.login(name, password)) }
  async function register(name: string, password: string) {
    await api.register(name, password)
    await login(name, password)
  }
  async function logout() {
    try { await api.logout() } catch { /* 本地会话仍需清除 */ } finally { clearCredentials() }
  }
  return { token, accountId, username, isLoggedIn, setSession, login, register, logout }
})
