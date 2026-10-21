<template>
  <header class="top-tabs">
    <div class="tabs">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="tab"
        :class="{ active: modelValue === t.key }"
        @click="$emit('update:modelValue', t.key)"
      >
        {{ t.label }}
      </button>
    </div>
    <button class="search" aria-label="搜索" @click="toast('搜索暂未接入后端接口')">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="7" />
        <path d="m16.5 16.5 4 4" stroke-linecap="round" />
      </svg>
    </button>
  </header>
</template>

<script setup lang="ts">
import { toast } from '@/utils/toast'

defineProps<{ modelValue: string }>()
defineEmits<{ 'update:modelValue': [string] }>()

const tabs = [
  { key: 'following', label: '关注' },
  { key: 'recommend', label: '推荐' }
]
</script>

<style scoped>
.top-tabs {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: calc(env(safe-area-inset-top, 0px) + 10px);
  height: calc(48px + env(safe-area-inset-top, 0px));
  pointer-events: none;
}

.tabs {
  display: flex;
  gap: 28px;
  pointer-events: auto;
}

.tab {
  position: relative;
  font-size: 16px;
  color: var(--text-secondary);
  padding: 4px 0;
}

.tab.active {
  color: #fff;
  font-size: 17px;
  font-weight: 600;
}

.tab.active::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -4px;
  transform: translateX(-50%);
  width: 20px;
  height: 2.5px;
  border-radius: 2px;
  background: #fff;
}

.search {
  position: absolute;
  right: 14px;
  top: calc(env(safe-area-inset-top, 0px) + 12px);
  color: #fff;
  pointer-events: auto;
}
</style>
