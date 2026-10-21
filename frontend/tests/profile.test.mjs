import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire, Module } from 'node:module'
import { fileURLToPath } from 'node:url'
import { parse, compileScript } from '@vue/compiler-sfc'
import { transformWithEsbuild } from 'vite'

const require = createRequire(import.meta.url)
const filename = fileURLToPath(new URL('../src/views/MeView.vue', import.meta.url))

async function setupProfile(answer) {
  const calls = []
  const notices = []
  const source = await readFile(filename, 'utf8')
  const { descriptor } = parse(source, { filename })
  const script = compileScript(descriptor, { id: 'profile-regression' })
  const { code } = await transformWithEsbuild(script.content, filename + '.ts', { loader: 'ts', format: 'cjs' })
  const module = new Module(filename)
  module.filename = filename
  module.require = name => {
    if (name === 'vue') return { ...require('vue'), onMounted() {} }
    if (name === 'vue-router') return { useRouter: () => ({ push() {} }) }
    if (name === '@/api') return { api: { updateProfile: async (...args) => { calls.push(args) } } }
    if (name === '@/api/http') return { errMsg: String }
    if (name === '@/stores/auth') return { useAuthStore: () => ({ isLoggedIn: true, accountId: 42, username: 'tester' }) }
    if (name === '@/stores/social') return { useSocialStore: () => ({ $reset() {} }) }
    if (name === '@/utils/format') return { formatCount: String }
    if (name === '@/utils/toast') return { toast: text => notices.push(text) }
    return require(name)
  }
  module._compile(code, filename)
  globalThis.window = { prompt: () => answer }
  const context = module.exports.default.setup({}, { expose() {} })
  context.profile.value = { id: 42, username: 'tester', avatar_url: '/static/avatar.png', bio: 'old bio' }
  return { context, calls, notices }
}

test('profile bio submits and displays the same trimmed 255 Unicode characters', async () => {
  const { context, calls, notices } = await setupProfile('  ' + '😀'.repeat(260) + '  ')
  context.editBio()
  await Promise.resolve()
  const expected = '😀'.repeat(255)
  assert.deepEqual(calls, [['/static/avatar.png', expected]])
  assert.equal(context.profile.value.bio, expected)
  assert.deepEqual(notices, ['简介已更新'])
})

test('clearing profile bio sends and displays an explicit empty value', async () => {
  const { context, calls } = await setupProfile('  ')
  context.editBio()
  await Promise.resolve()
  assert.deepEqual(calls, [['/static/avatar.png', '']])
  assert.equal(context.profile.value.bio, '')
})

test('cancelling bio editing preserves profile without issuing a request', async () => {
  const { context, calls } = await setupProfile(null)
  context.editBio()
  await Promise.resolve()
  assert.deepEqual(calls, [])
  assert.equal(context.profile.value.bio, 'old bio')
})
