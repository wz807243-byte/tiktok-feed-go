import { createRouter, createWebHistory } from 'vue-router'
import { LS_KEYS } from '@/api/http'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/feed' },
    { path: '/feed', name: 'feed', component: () => import('@/views/FeedView.vue') },
    { path: '/hot', name: 'hot', component: () => import('@/views/HotView.vue') },
    { path: '/friends', name: 'friends', component: () => import('@/views/FriendsView.vue') },
    {
      path: '/publish',
      name: 'publish',
      component: () => import('@/views/PublishView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/messages',
      name: 'messages',
      component: () => import('@/views/MessagesView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/chat/:peerId',
      name: 'chat',
      component: () => import('@/views/ChatView.vue'),
      meta: { requiresAuth: true, hideNav: true }
    },
    { path: '/me', name: 'me', component: () => import('@/views/MeView.vue') },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { hideNav: true }
    }
  ]
})

router.beforeEach((to) => {
  const token = localStorage.getItem(LS_KEYS.token)
  if (to.meta.requiresAuth && !token) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  return true
})

export default router
