import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire, Module } from 'node:module'
import { fileURLToPath } from 'node:url'
import { transformWithEsbuild } from 'vite'
const require = createRequire(import.meta.url)

async function setup(relative = '../src/composables/useHotFeed.ts', overrides = {}) {
  const filename = fileURLToPath(new URL(relative, import.meta.url))
  const { code } = await transformWithEsbuild(await readFile(filename, 'utf8'), filename, {loader: 'ts', format: 'cjs'})
  let unmount
  const mod = new Module(filename)
  mod.filename = filename
  mod.require = name => {
    if (name in overrides) return overrides[name]
    if (name === 'vue') return {...require('vue'), onBeforeUnmount: callback => {unmount = callback}}
    if (name === '@/api') return {api: {}}
    if (name === '@/api/http') return {errMsg: error => error.message}
    return require(name)
  }
  mod._compile(code, filename)
  return {...mod.exports, unmount: () => unmount?.()}
}
const item = id => ({id, title: 'video '+id, author: {id: 8, username: 'test'}, play_url: '/static/'+id+'.mp4', cover_url: '/static/'+id+'.png', create_time: 100, likes_count: 0, is_liked: false})
const page = (ids, extra = {}) => ({video_list: ids.map(item), as_of: 1000, next_offset: ids.length, has_more: false, ...extra})

test('hot real API posts the backend popularity contract without translating the cursor', async () => {
  const calls=[]
  const {realApi}=await setup('../src/api/real.ts', {'./http': {__esModule:true, default:{post: async (...args)=>{calls.push(args);return {data:page([4])}}}}})
  const request={limit:12,as_of:1000,offset:12,latest_popularity:0,latest_before:'2026-10-18T15:31:20.848Z',latest_id_before:6}
  const result=await realApi.feedPopularity(request)
  assert.deepEqual(calls,[['/feed/listByPopularity',request]])
  assert.equal(result.video_list[0].id,4)
})

test('hot snapshot pagination preserves all fallback fields including zero popularity and milliseconds', async () => {
  const {nextHotPage}=await setup()
  const before='2026-10-18T15:31:20.848Z'
  assert.deepEqual(nextHotPage({limit:12,as_of:0,offset:0},page([6],{has_more:true,next_offset:12,next_latest_popularity:0,next_latest_before:before,next_latest_id_before:6})),{limit:12,as_of:1000,offset:12,latest_popularity:0,latest_before:before,latest_id_before:6})
})

test('hot database fallback advances by the complete tuple with equal timestamps', async () => {
  const {nextHotPage}=await setup()
  const previous={limit:12,as_of:0,offset:0,latest_popularity:0,latest_before:'2026-10-18T15:31:20.848Z',latest_id_before:8}
  const response=page([6],{as_of:0,has_more:true,next_offset:0,next_latest_popularity:0,next_latest_before:previous.latest_before,next_latest_id_before:6})
  assert.equal(nextHotPage(previous,response).latest_id_before,6)
  response.next_latest_id_before=8
  assert.equal(nextHotPage(previous,response),null)
})

test('hot does not repeatedly request an unchanged or incomplete cursor', async () => {
  const {useHotFeed}=await setup()
  let calls=0
  const feed=useHotFeed(async()=>{calls++;return page([4],{as_of:0,has_more:true,next_offset:0})})
  await feed.refresh()
  assert.match(feed.error.value,/刷新榜单/)
  assert.equal(calls,1)
  assert.equal(feed.loading.value,false)
})

test('hot pages deduplicate IDs and preserve backend ranking instead of sorting by likes', async () => {
  const {useHotFeed}=await setup()
  const calls=[]
  const feed=useHotFeed(async request=>{calls.push(request);return calls.length===1?page([8,6,8],{next_offset:3,has_more:true}):page([6,4],{next_offset:5})})
  await feed.refresh();await feed.loadMore();await feed.loadMore()
  assert.deepEqual(calls,[{limit:12,as_of:0,offset:0},{limit:12,as_of:1000,offset:3}])
  assert.deepEqual(feed.videos.value.map(v=>v.id),[8,6,4])
  assert.equal(feed.hasMore.value,false)
})

test('hot retry preserves the page cursor and existing ranked videos', async () => {
  const {useHotFeed}=await setup()
  const requests=[]
  const feed=useHotFeed(async request=>{requests.push(request);if(requests.length===2)throw Error('offline');return requests.length===1?page([8],{next_offset:1,has_more:true}):page([6],{next_offset:2})})
  await feed.refresh();await feed.loadMore()
  assert.deepEqual(feed.videos.value.map(v=>v.id),[8])
  assert.equal(feed.error.value,'offline')
  await feed.loadMore()
  assert.deepEqual(requests[1],requests[2])
  assert.deepEqual(feed.videos.value.map(v=>v.id),[8,6])
  assert.equal(feed.error.value,'')
})

test('hot refresh resets the snapshot and ignores the late old response', async () => {
  const {useHotFeed}=await setup()
  let release,calls=0
  const feed=useHotFeed(async()=>++calls===1?await new Promise(resolve=>{release=resolve}):page([4]))
  const old=feed.refresh()
  await feed.refresh()
  release(page([8]))
  await old
  assert.deepEqual(feed.videos.value.map(v=>v.id),[4])
  assert.equal(feed.loading.value,false)
})

test('hot empty results end pagination without rendering invented fallback videos', async () => {
  const {useHotFeed}=await setup()
  const feed=useHotFeed(async()=>page([],{has_more:true,next_offset:12}))
  await feed.refresh()
  assert.equal(feed.videos.value.length,0)
  assert.equal(feed.hasMore.value,false)
  assert.equal(feed.error.value,'')
})

test('hot pending response is ignored after leaving the page', async () => {
  const module=await setup();let release
  const feed=module.useHotFeed(()=>new Promise(resolve=>{release=resolve}))
  const pending=feed.refresh();module.unmount();release(page([8]));await pending
  assert.equal(feed.videos.value.length,0)
})

test('hot Mock exposes the same snapshot pagination contract', async () => {
  const {mockApi}=await setup('../src/api/mock.ts')
  const first=await mockApi.feedPopularity({limit:3,as_of:0,offset:0})
  const second=await mockApi.feedPopularity({limit:3,as_of:first.as_of,offset:first.next_offset})
  assert.equal(first.video_list.length,3)
  assert.equal(first.as_of,second.as_of)
  assert.equal(second.next_offset,6)
  assert.equal(new Set([...first.video_list,...second.video_list].map(v=>v.id)).size,6)
})
