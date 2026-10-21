<template>
  <div class="app-shell">
    <SideNav v-if="!hideNav" />
    <main class="app-main">
      <router-view v-slot="{ Component }">
        <keep-alive include="FeedView">
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </main>
    <BottomNav v-if="!hideNav" />
    <Toast />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import SideNav from './components/SideNav.vue'
import BottomNav from './components/BottomNav.vue'
import Toast from './components/Toast.vue'

const route = useRoute()
const hideNav = computed(() => route.meta.hideNav === true)
</script>
