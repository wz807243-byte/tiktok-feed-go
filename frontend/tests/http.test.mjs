import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire, Module } from 'node:module'
import { fileURLToPath } from 'node:url'
import { transformWithEsbuild } from 'vite'

const require = createRequire(import.meta.url)
const axios = require('axios')
const root = fileURLToPath(new URL('../', import.meta.url))
const reply = (config, data, status = 200) => ({ config, data, status, statusText: String(status), headers: {} })
function fail(config, status) {
  throw new axios.AxiosError('HTTP ' + status, 'ERR_BAD_REQUEST', config, null, reply(config, { error: 'failure' }, status))
}
async function setup(adapter, mock = false) {
  const storage = new Map()
  globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) }
  const redirects = []
  globalThis.window = { location: { pathname: '/feed', search: '?tab=following', hash: '#current', assign: url => redirects.push(url) } }
  axios.defaults.adapter = adapter
  const filename = root + 'src/api/http.ts'
  const source = await readFile(filename, 'utf8')
  const { code } = await transformWithEsbuild(source, filename, { loader: 'ts', format: 'cjs' })
  const module = new Module(filename)
  module.filename = filename
  module.require = id => id === './config' ? { API_BASE_URL: '/api', USE_MOCK: mock } : require(id)
  module._compile(code, filename)
  const api = module.exports
  const login = (token = 'old', rt = 'refresh-old') => api.saveCredentials({ token, refresh_token: rt, account_id: 7, username: 'test-user' })
  return { ...api, login, storage, redirects }
}

test('requests use /api and Bearer credentials; mock storage is isolated', async () => {
  let request
  const app = await setup(async c => { request = c; return reply(c, {}) })
  app.login()
  await app.default.post('/feed/listLatest', { limit: 10, latest_time: 1234 })
  assert.equal(request.baseURL, '/api')
  assert.equal(request.headers.Authorization, 'Bearer old')
  assert.deepEqual(JSON.parse(request.data), { limit: 10, latest_time: 1234 })
  assert.equal(app.LS_KEYS.token, 'douyin.real.token')
  const mock = await setup(async c => reply(c, {}), true)
  assert.equal(mock.LS_KEYS.token, 'douyin.mock.token')
})

test('concurrent 401 responses share one refresh and update reactive session', async () => {
  let refreshes = 0
  const app = await setup(async c => {
    if (c.url === '/account/refresh') {
      refreshes++
      assert.equal(c.baseURL, '/api')
      assert.equal(c.timeout, 15000)
      await new Promise(resolve => setTimeout(resolve, 10))
      return reply(c, { token: 'new', account_id: 7, username: 'test-user' })
    }
    if (c.headers.Authorization === 'Bearer old') fail(c, 401)
    return reply(c, { ok: true })
  })
  app.login()
  await Promise.all([app.default.post('/like/isLiked'), app.default.post('/social/getCounts')])
  assert.equal(refreshes, 1)
  assert.equal(app.session.token, 'new')
  assert.equal(app.storage.get(app.LS_KEYS.token), 'new')
})

test('late old-token 401 reuses refreshed token without refreshing again', async () => {
  let refreshes = 0
  const app = await setup(async c => {
    if (c.url === '/account/refresh') { refreshes++; return reply(c, { token: 'new', account_id: 7, username: 'test-user' }) }
    if (c.headers.Authorization === 'Bearer old') {
      if (c.url === '/late') await new Promise(resolve => setTimeout(resolve, 25))
      fail(c, 401)
    }
    return reply(c, {})
  })
  app.login()
  await Promise.all([app.default.post('/fast'), app.default.post('/late')])
  assert.equal(refreshes, 1)
})

test('refresh service outage preserves credentials for retry', async () => {
  const app = await setup(async c => fail(c, c.url === '/account/refresh' ? 503 : 401))
  app.login()
  await assert.rejects(app.default.post('/private'))
  assert.equal(app.session.token, 'old')
  assert.equal(app.redirects.length, 0)
})

test('invalid refresh clears session and preserves the full return URL', async () => {
  const app = await setup(async c => fail(c, 401))
  app.login()
  await assert.rejects(app.default.post('/private'))
  assert.equal(app.session.token, '')
  assert.equal(app.storage.size, 0)
  assert.deepEqual(app.redirects, ['/login?redirect=' + encodeURIComponent('/feed?tab=following#current')])
})

test('a second 401 after refresh stops retrying and clears session', async () => {
  let refreshes = 0
  const app = await setup(async c => {
    if (c.url === '/account/refresh') { refreshes++; return reply(c, { token: 'new', account_id: 7, username: 'test-user' }) }
    fail(c, 401)
  })
  app.login()
  await assert.rejects(app.default.post('/private'))
  assert.equal(refreshes, 1)
  assert.equal(app.session.token, '')
})

test('failed login never triggers refresh or attaches an existing token', async () => {
  let count = 0
  const app = await setup(async c => { count++; assert.equal(c.url, '/account/login'); assert.equal(c.headers.Authorization, undefined); fail(c, 401) })
  app.login()
  await assert.rejects(app.default.post('/account/login', {}))
  assert.equal(count, 1)
  assert.equal(app.session.token, 'old')
})

test('refresh finishing after logout cannot restore the old session', async () => {
  let release, entered
  const ready = new Promise(resolve => { entered = resolve })
  const app = await setup(async c => {
    if (c.url === '/account/refresh') {
      entered()
      await new Promise(resolve => { release = resolve })
      return reply(c, { token: 'new', account_id: 7, username: 'test-user' })
    }
    fail(c, 401)
  })
  app.login()
  const pending = app.default.post('/private')
  const rejected = assert.rejects(pending)
  await ready
  app.clearCredentials()
  release()
  await rejected
  assert.equal(app.session.token, '')
  assert.equal(app.storage.size, 0)
})

test('invalid refresh payload never stores an undefined token', async () => {
  const app = await setup(async c => c.url === '/account/refresh' ? reply(c, {}) : fail(c, 401))
  app.login()
  await assert.rejects(app.default.post('/private'))
  assert.equal(app.session.token, '')
  assert.equal(app.storage.get(app.LS_KEYS.token), undefined)
})

test('late response from an old account is not replayed as the new account', async () => {
  let release, entered, count = 0
  const ready = new Promise(resolve => { entered = resolve })
  const app = await setup(async c => {
    count++; entered()
    await new Promise(resolve => { release = resolve })
    fail(c, 401)
  })
  app.login()
  const pending = assert.rejects(app.default.post('/comment/delete', { comment_id: 10 }))
  await ready
  app.login('other-token', 'other-refresh')
  release()
  await pending
  assert.equal(count, 1)
  assert.equal(app.session.token, 'other-token')
})

test('current Go login error fields are readable', async () => {
  const app = await setup(async c => reply(c, {}))
  const config = {}
  const error = new axios.AxiosError('request failed', 'ERR_BAD_RESPONSE', config, null, reply(config, { 'account error': 'account not found' }, 500))
  assert.equal(app.errMsg(error), 'account not found')
})


test('missing endpoints and account failures explain the actual cause', async () => {
  const app = await setup(async c => reply(c, {}))
  const make = (url, status, data) => {
    const config = {url}
    return new axios.AxiosError('request failed', 'ERR_BAD_RESPONSE', config, null, reply(config, data, status))
  }
  assert.equal(app.errMsg(make('/feed/listLatest', 404, '404 page not found')), '请求接口不存在，请确认后端服务版本')
  assert.equal(app.errMsg(make('/account/login', 500, {'accessToken, refreshToken error': 'crypto/bcrypt: hashedPassword is not the hash of the given password'})), '用户名或密码错误')
  assert.equal(app.errMsg(make('/account/register', 500, {error: "Error 1062: Duplicate entry 'qa' for key 'accounts.idx_accounts_username'"})), '用户名已存在，请直接登录或更换用户名')
})


test('uploaded local media remains accessible when the frontend directory or port changes', async () => {
  const app = await setup(async c => reply(c, {
    video_list: [{play_url:'http://127.0.0.1:5566/static/videos/32/test.mp4?v=1',cover_url:'http://localhost:5173/static/covers/32/test.png'}],
    author:{avatar_url:'http://127.0.0.1:18080/static/avatars/32/avatar.png'},
    external:{play_url:'https://cdn.example.com/static/demo.mp4'},
    relative:{cover_url:'/static/covers/already-relative.png'}
  }))
  const {data} = await app.default.post('/feed/listLatest', {})
  assert.equal(data.video_list[0].play_url, '/static/videos/32/test.mp4?v=1')
  assert.equal(data.video_list[0].cover_url, '/static/covers/32/test.png')
  assert.equal(data.author.avatar_url, '/static/avatars/32/avatar.png')
  assert.equal(data.external.play_url, 'https://cdn.example.com/static/demo.mp4')
  assert.equal(data.relative.cover_url, '/static/covers/already-relative.png')
})
