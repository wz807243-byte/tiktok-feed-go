import { reactive } from 'vue'

/** 全局轻提示 */
export const toastState = reactive({
  msg: '',
  visible: false,
  timer: 0 as unknown as ReturnType<typeof setTimeout>
})

export function toast(msg: string, ms = 1800) {
  toastState.msg = msg
  toastState.visible = true
  clearTimeout(toastState.timer)
  toastState.timer = setTimeout(() => {
    toastState.visible = false
  }, ms)
}
