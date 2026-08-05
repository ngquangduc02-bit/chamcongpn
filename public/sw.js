const CACHE_NAME = 'chamcong-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

// Install: lưu trữ sẵn các file tĩnh cơ bản
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: dọn dẹp các cache cũ khác
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: cơ chế Stale-While-Revalidate (lấy từ cache trước, cập nhật từ mạng sau)
self.addEventListener('fetch', (e) => {
  // Chỉ xử lý các yêu cầu GET
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Không cache các yêu cầu API đến Supabase hoặc Telegram Webhook
  if (url.origin.includes('supabase.co') || url.pathname.includes('/api/')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Nếu có trong cache, trả về trước và tải ngầm bản mới từ mạng để cập nhật cache
        fetch(e.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse));
            }
          })
          .catch(() => {}); // Bỏ qua lỗi kết nối ngầm
        return cachedResponse;
      }

      // Nếu không có trong cache, tải từ mạng
      return fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Nếu mất mạng và là trang điều hướng, trả về trang chính
        if (e.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});
