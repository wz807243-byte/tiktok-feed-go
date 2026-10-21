<template>
  <div class="page">
    <header class="page-header">发布视频</header>

    <div class="form">
      <!-- 视频选择 -->
      <label class="picker" :class="{ filled: videoFile }">
        <input type="file" accept="video/mp4" hidden @change="onVideoChange" />
        <template v-if="!videoFile">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="6" width="13" height="12" rx="2" />
            <path d="m16 10 5-3v10l-5-3" stroke-linejoin="round" />
          </svg>
          <span>选择视频（mp4，≤200MB）</span>
        </template>
        <template v-else>
          <span class="file-name">{{ videoFile.name }}</span>
          <span class="file-size">{{ (videoFile.size / 1024 / 1024).toFixed(1) }} MB · 点击更换</span>
        </template>
      </label>

      <!-- 封面选择 -->
      <label class="picker cover" :class="{ filled: coverFile }">
        <input type="file" accept="image/jpeg,image/png,image/webp" hidden @change="onCoverChange" />
        <img v-if="coverPreview" :src="coverPreview" alt="封面预览" />
        <template v-else>
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="9" cy="10" r="2" />
            <path d="m4 18 5-5 4 4 3-3 4 4" stroke-linejoin="round" />
          </svg>
          <span>选择封面（必填）</span>
        </template>
      </label>

      <input v-model="title" class="field" placeholder="标题（必填）" maxlength="50" />
      <textarea
        v-model="description"
        class="field area"
        placeholder="添加视频描述… 可以带上 #话题"
        rows="3"
        maxlength="255"
      ></textarea>

      <button class="btn-primary" :disabled="!canSubmit" @click="submit">
        {{ stepText }}
      </button>
      <p v-if="uploadPercent > 0 && uploadPercent < 100" class="percent">
        视频上传中 {{ uploadPercent }}%
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/api'
import { errMsg } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { toast } from '@/utils/toast'

const router = useRouter()
const auth = useAuthStore()

const videoFile = ref<File | null>(null)
const coverFile = ref<File | null>(null)
const coverPreview = ref('')
const title = ref('')
const description = ref('')
const stepText = ref('发布')
const uploadPercent = ref(0)
const busy = ref(false)

const canSubmit = computed(
  () => videoFile.value && coverFile.value && title.value.trim() && !busy.value
)

function onVideoChange(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  if (!f.name.toLowerCase().endsWith('.mp4')) {
    toast('后端目前只接受 mp4 格式')
    return
  }
  if (f.size === 0 || f.size > 200 * 1024 * 1024) {
    toast('视频不能超过 200MB')
    return
  }
  videoFile.value = f
}

function onCoverChange(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  if (!/\.(jpe?g|png|webp)$/i.test(f.name) || f.size === 0 || f.size > 200 * 1024 * 1024) {
    toast('请选择有效的 jpg、png 或 webp 封面，大小不超过 200MB')
    return
  }
  if (coverPreview.value) URL.revokeObjectURL(coverPreview.value)
  coverFile.value = f
  coverPreview.value = URL.createObjectURL(f)
}

async function submit() {
  if (!canSubmit.value || !videoFile.value || !coverFile.value) return
  busy.value = true
  uploadPercent.value = 0
  try {
    // 第一步：传视频
    stepText.value = '上传视频中…'
    const { play_url } = await api.uploadVideo(videoFile.value, (p) => {
      uploadPercent.value = p
    })

    // 后端要求真实的封面地址，先上传用户选择的封面。
    stepText.value = '上传封面中…'
    const { cover_url } = await api.uploadCover(coverFile.value)

    // 第三步：提交元数据
    stepText.value = '发布中…'
    await api.publishVideo({
      title: title.value.trim(),
      description: description.value.trim(),
      play_url,
      cover_url
    })
    toast('发布成功')
    const query: Record<string, string> = { refresh: String(Date.now()) }
    // 发布事务已写入作品表；直接查作品避免推荐缓存异步更新时看不到新视频。
    try {
      const works = await api.videosByAuthor(auth.accountId)
      const published = (works || []).find(video => video.play_url === play_url)
      if (published) {
        query.video = String(published.id)
        query.author = String(published.author_id)
      }
    } catch { /* 发布已成功，作品查询失败时仍可正常返回推荐。 */ }
    router.push({ path: '/feed', query })
  } catch (e) {
    toast(errMsg(e))
    stepText.value = '发布'
  } finally {
    busy.value = false
  }
}
onBeforeUnmount(() => { if (coverPreview.value) URL.revokeObjectURL(coverPreview.value) })
</script>

<style scoped>
.form {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.picker {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 140px;
  border: 1px dashed rgba(255, 255, 255, 0.25);
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
  cursor: pointer;
  overflow: hidden;
}

.picker.cover {
  min-height: 100px;
}

.picker.filled {
  border-style: solid;
  color: var(--text-primary);
}

.picker img {
  width: 100%;
  max-height: 220px;
  object-fit: cover;
}

.file-name {
  font-weight: 600;
  word-break: break-all;
  padding: 0 12px;
  text-align: center;
}

.file-size {
  font-size: 12px;
  color: var(--text-secondary);
}

.field {
  padding: 12px 14px;
}

.field.area {
  resize: none;
}

.percent {
  text-align: center;
  color: var(--accent-cyan);
  font-size: 13px;
}
</style>
