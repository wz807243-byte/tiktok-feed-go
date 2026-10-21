/** 数字格式化：按设计稿规则 —— >=10000 用 K 缩写（128.4K），<10000 千分位（6,208） */
export function formatCount(n: number): string {
  if (n >= 10000) {
    const k = n / 1000
    return (Number.isInteger(k) ? k.toFixed(0) : k.toFixed(1)) + 'K'
  }
  return n.toLocaleString('en-US')
}

/** 相对时间：秒级时间戳或 RFC3339 字符串均可 */
export function formatTime(t: number | string): string {
  const ms = typeof t === 'number' ? t * 1000 : new Date(t).getTime()
  if (Number.isNaN(ms)) return ''
  const diff = Date.now() - ms
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min}分钟前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour}小时前`
  const day = Math.floor(hour / 24)
  if (day < 30) return `${day}天前`
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
