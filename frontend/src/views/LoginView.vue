<template>
  <div class="login-page">
    <button class="close" aria-label="返回" @click="$router.push('/feed')">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
      </svg>
    </button>

    <h1>{{ mode === 'login' ? '登录' : '注册' }}</h1>

    <form class="form" @submit.prevent="submit">
      <input v-model.trim="username" placeholder="用户名" autocomplete="username" />
      <input
        v-model="password"
        type="password"
        placeholder="密码"
        autocomplete="current-password"
      />
      <input
        v-if="mode === 'register'"
        v-model="password2"
        type="password"
        placeholder="确认密码"
        autocomplete="new-password"
      />
      <p v-if="error" class="error">{{ error }}</p>
      <button class="btn-primary" :disabled="busy" type="submit">
        {{ busy ? '请稍候…' : mode === 'login' ? '登录' : '注册并登录' }}
      </button>
    </form>

    <p class="switch">
      {{ mode === 'login' ? '还没有账号？' : '已有账号？' }}
      <a @click="switchMode">{{ mode === 'login' ? '去注册' : '去登录' }}</a>
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSocialStore } from '@/stores/social'
import { errMsg } from '@/api/http'
import { toast } from '@/utils/toast'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const social = useSocialStore()

const mode = ref<'login' | 'register'>('login')
const username = ref('')
const password = ref('')
const password2 = ref('')
const error = ref('')
const busy = ref(false)

function switchMode() {
  mode.value = mode.value === 'login' ? 'register' : 'login'
  error.value = ''
}

async function submit() {
  error.value = ''
  if (!username.value || !password.value) {
    error.value = '请输入用户名和密码'
    return
  }
  if (mode.value === 'register' && password.value !== password2.value) {
    error.value = '两次输入的密码不一致'
    return
  }
  busy.value = true
  try {
    if (mode.value === 'login') await auth.login(username.value, password.value)
    else await auth.register(username.value, password.value)
    social.$reset()
    await social.loadFollowing()
    toast(`欢迎，${username.value}`)
    const redirect = String(route.query.redirect || '/feed')
    router.replace(redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/feed')
  } catch (e) {
    error.value = errMsg(e)
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.login-page {
  height: 100%;
  max-width: 420px;
  margin: 0 auto;
  padding: 60px 32px;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.close {
  position: absolute;
  top: calc(14px + env(safe-area-inset-top, 0px));
  right: 16px;
  color: var(--text-secondary);
}

h1 {
  font-size: 22px;
  margin-bottom: 28px;
}

.form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form input {
  padding: 13px 16px;
  font-size: 15px;
}

.error {
  color: var(--accent-red);
  font-size: 13px;
}

.switch {
  margin-top: 20px;
  color: var(--text-secondary);
  font-size: 14px;
}

.switch a {
  color: var(--accent-red);
  cursor: pointer;
}
</style>
