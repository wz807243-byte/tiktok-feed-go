<template>
  <transition name="toast-fade">
    <div v-if="toastState.visible" class="toast">{{ toastState.msg }}</div>
  </transition>
</template>

<script setup lang="ts">
import { toastState } from '@/utils/toast'
</script>

<style scoped>
.toast {
  position: fixed;
  left: 50%;
  bottom: calc(var(--nav-h) + 48px);
  transform: translateX(-50%);
  z-index: 999;
  padding: 10px 20px;
  border-radius: 20px;
  background: rgba(30, 30, 34, 0.95);
  color: #fff;
  font-size: 14px;
  white-space: nowrap;
  pointer-events: none;
}

@media (min-width: 900px) {
  .toast {
    bottom: 48px;
  }
}
</style>
