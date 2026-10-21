<template>
  <aside class="side-nav">
    <nav class="menu">
      <router-link to="/feed" class="item" :class="{ active: isActive('/feed') }">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" stroke-linejoin="round" />
        </svg>
        <span>首页</span>
      </router-link>

      <router-link to="/hot" class="item" :class="{ active: isActive('/hot') }">
        <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M13 2c1 5-2 6-2 9 0 1 1 2 2 2 2 0 3-2 3-4 3 3 4 5 4 7a8 8 0 0 1-16 0c0-3 2-6 5-9 0 3 0 4 1 5-1-5 4-6 3-10Z" stroke-linecap="round" stroke-linejoin="round" /></svg>
        <span>热度</span>
      </router-link>

      <router-link to="/friends" class="item" :class="{ active: isActive('/friends') }">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 20c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" stroke-linecap="round" />
          <circle cx="17" cy="9" r="2.4" />
          <path d="M15.8 14.6c2.4.3 4.1 2 4.7 4.4" stroke-linecap="round" />
        </svg>
        <span>好友</span>
      </router-link>

      <router-link to="/messages" class="item" :class="{ active: isActive('/messages') }">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m4 7 8 6 8-6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>消息</span>
      </router-link>

      <router-link to="/me" class="item" :class="{ active: isActive('/me') }">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="12" cy="8" r="3.6" />
          <path d="M5 20.5c.8-3.8 3.6-6 7-6s6.2 2.2 7 6" stroke-linecap="round" />
        </svg>
        <span>我</span>
      </router-link>
    </nav>

    <router-link to="/publish" class="publish-cta">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#000" stroke-width="3">
        <path d="M12 5v14M5 12h14" stroke-linecap="round" />
      </svg>
      <span>发布视频</span>
    </router-link>

    <p class="tip">{{ USE_MOCK ? '演示模式 · 刷新后重置' : '真实数据模式' }}</p>
  </aside>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { USE_MOCK } from '@/api/config'

const route = useRoute()
const isActive = (prefix: string) => route.path === prefix || route.path.startsWith(prefix + '/')
</script>

<style scoped>
.side-nav {
  display: none;
}

@media (min-width: 900px) {
  .side-nav {
    display: flex;
    flex-direction: column;
    flex: none;
    width: 220px;
    height: 100%;
    padding: 20px 12px;
    background: var(--bg-nav);
    border-right: 0.5px solid var(--border-subtle);
  }
}

.menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 11px 14px;
  border-radius: var(--radius-md);
  font-size: 16px;
  color: var(--text-secondary);
}

.item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.item.active {
  color: var(--accent-red);
  font-weight: 600;
}

.publish-cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 18px 6px 0;
  padding: 12px;
  border-radius: var(--radius-md);
  background: #fff;
  color: #000;
  font-weight: 600;
  font-size: 15px;
}

.publish-cta:hover {
  filter: brightness(0.92);
}

.tip {
  margin-top: auto;
  padding: 0 14px;
  font-size: 12px;
  color: var(--text-tertiary);
}
</style>
