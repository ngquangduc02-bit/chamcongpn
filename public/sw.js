const CACHE_NAME = 'chamcong-v2';
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

// Install: lưu trữ các asset tĩnh cơ bản
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Activate: tự động xóa toàn bộ các bản cache cũ (v1) ngay lập tức
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

// Fetch handling
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Không can thiệp API Supabase & Telegram Webhook
  if (url.origin.includes('supabase.co') || url.pathname.includes('/api/')) {
    return;
  }

  // Đối với điều hướng HTML (trang web chính): luôn lấy từ Network trước để luôn nhận file JS/CSS chứa hash mới nhất từ Vercel!
  if (e.request.mode === 'navigate' || e.request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(
      fetch(e.request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          // Khi ngoại tuyến (không có mạng), dùng bản cache index.html
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // Đổi với asset (ảnh, icon, font): lấy từ cache trước, cập nhật mạng ngầm
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(e.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse));
            }
          })
          .catch(() => {});
        return cachedResponse;
      }
      return fetch(e.request);
    })
  );
});
