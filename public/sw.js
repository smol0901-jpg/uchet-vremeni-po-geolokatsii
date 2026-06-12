const CACHE = 'wt-v1'
self.addEventListener('install', e => { self.skipWaiting() })
self.addEventListener('activate', e => { e.waitUntil(clients.claim()) })
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      try {
        const fresh = await fetch(e.request)
        if (e.request.method === 'GET') cache.put(e.request, fresh.clone())
        return fresh
      } catch {
        return cache.match(e.request)
      }
    })
  )
})
