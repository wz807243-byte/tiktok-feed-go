import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = Number(env.VITE_DEV_PORT || 5173)
  const target = env.VITE_API_TARGET || 'http://127.0.0.1:8080'
  const proxy = {
    '/api': {
      target,
      changeOrigin: false,
      rewrite: (url: string) => url.replace(/^\/api(?=\/|$)/, '')
    },
    // 上传接口返回 /static 资源，保留原 Host 以通过前端源站访问。
    '/static': { target, changeOrigin: false }
  }
  return {
    plugins: [vue()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: { host: true, port, proxy },
    preview: { host: true, proxy }
  }
})
