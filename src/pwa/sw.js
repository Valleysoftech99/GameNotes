const CACHE_PREFIX = 'notegame-static-'
const CACHE_NAME = __CACHE_NAME__
const PRECACHE_URLS = __PRECACHE_URLS__

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    await cache.addAll(PRECACHE_URLS)
    // Let an older worker finish serving its open tabs before activating this cache.
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys()
    await Promise.all(cacheNames
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const requestUrl = new URL(request.url)
  const scopeUrl = new URL(self.registration.scope)
  if (requestUrl.origin !== scopeUrl.origin || !requestUrl.pathname.startsWith(scopeUrl.pathname)) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME)
      const indexUrl = new URL('index.html', scopeUrl).href
      return (await cache.match(indexUrl)) ?? Response.error()
    }))
    return
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME)
    return (await cache.match(request)) ?? fetch(request)
  })())
})
