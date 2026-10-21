<template>
  <nav class="bottom-nav">
    <router-link to="/feed" class="nav-item" :class="{ active: isActive('/feed') }">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" stroke-linejoin="round" />
      </svg>
      <span>首页</span>
    </router-link>

    <router-link to="/hot" class="nav-item" :class="{ active: isActive('/hot') }">
      <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M13 2c1 5-2 6-2 9 0 1 1 2 2 2 2 0 3-2 3-4 3 3 4 5 4 7a8 8 0 0 1-16 0c0-3 2-6 5-9 0 3 0 4 1 5-1-5 4-6 3-10Z" stroke-linecap="round" stroke-linejoin="round" /></svg>
      <span>热度</span>
    </router-link>

    <router-link to="/friends" class="nav-item" :class="{ active: isActive('/friends') }">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8">
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3.5 20c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" stroke-linecap="round" />
        <circle cx="17" cy="9" r="2.4" />
        <path d="M15.8 14.6c2.4.3 4.1 2 4.7 4.4" stroke-linecap="round" />
      </svg>
      <span>好友</span>
    </router-link>

    <router-link to="/publish" class="nav-item publish" aria-label="发布">
      <span class="publish-btn">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#000" stroke-width="2.6">
          <path d="M12 5v14M5 12h14" stroke-linecap="round" />
        </svg>
      </span>
    </router-link>

    <router-link to="/messages" class="nav-item" :class="{ active: isActive('/messages') }">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span>消息</span>
    </router-link>

    <router-link to="/me" class="nav-item" :class="{ active: isActive('/me') }">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8">
        <circle cx="12" cy="8" r="3.6" />
        <path d="M5 20.5c.8-3.8 3.6-6 7-6s6.2 2.2 7 6" stroke-linecap="round" />
      </svg>
      <span>我</span>
    </router-link>
  </nav>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
const isActive = (prefix: string) => route.path === prefix || route.path.startsWith(prefix + '/')
</script>

<style scoped>
.bottom-nav {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  display: flex;
  align-items: stretch;
  height: var(--nav-h);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background: var(--bg-nav);
  border-top: 0.5px solid var(--border-subtle);
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: var(--text-secondary);
  font-size: 10px;
}

.nav-item.active {
  color: #fff;
}

/* 发布按钮：白底 + 左青右红错位叠影 */
.publish {
  justify-content: center;
}

.publish-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 30px;
  border-radius: 8px;
  background: #fff;
  box-shadow:
    -3px 0 0 var(--accent-cyan),
    3px 0 0 var(--accent-red);
}

/* 桌面端改用左侧导航栏 */
@media (min-width: 900px) {
  .bottom-nav {
    display: none;
  }
}
</style>
