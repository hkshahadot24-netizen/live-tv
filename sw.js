```javascript
/**
 * LIVE IP TV PRO - Optimized Service Worker
 * Version: v1.5 (High Performance & Cache Configured)
 */

const CACHE_NAME = 'iptv-pro-static-v1.5';
const RUNTIME_CACHE = 'iptv-pro-runtime';

// ক্যাশ করার জন্য অ্যাপের মূল রিসোর্সসমূহ
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  // এক্সটার্নাল লাইব্রেরিগুলো ক্যাশ করে নেওয়া হচ্ছে যাতে পরবর্তীতে ইন্টারনেট ডাউন থাকলেও প্লেয়ার ওপেন হয়
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/video.js/8.10.0/video-js.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/video.js/8.10.0/video.min.js',
  'https://unpkg.com/videojs-contrib-quality-levels@4.1.0/dist/videojs-contrib-quality-levels.min.js',
  'https://unpkg.com/videojs-hls-quality-selector@2.0.0/dist/videojs-hls-quality-selector.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// ইনস্টলেশন ইভেন্ট: কোর ফাইলগুলো ক্যাশ করা
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// এক্টিভেশন ইভেন্ট: পুরনো ক্যাশ ডিলিট করা
self.addEventListener('activate', (event) => {
  const currentCaches = [CACHE_NAME, RUNTIME_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return cacheNames.filter((cacheName) => !currentCaches.includes(cacheName));
    }).then((cachesToDelete) => {
      return Promise.all(
        cachesToDelete.map((cacheToDelete) => caches.delete(cacheToDelete))
      );
    }).then(() => self.clients.claim())
  );
});

// ইন্টারসেপ্ট রিকোয়েস্টস ও ক্যাশ পলিসি
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // ১. স্ট্রিমিং ও লাইভ ভিডিও বাইপাস (এটি স্ট্রিমিং স্মুথ রাখার জন্য অত্যন্ত জরুরী!)
  if (
    url.pathname.endsWith('.m3u8') || 
    url.pathname.endsWith('.ts') || 
    url.pathname.endsWith('.mp4') || 
    url.pathname.endsWith('.mkv') || 
    url.pathname.endsWith('.mp3') ||
    url.pathname.endsWith('.key') ||
    url.href.includes('stream') ||
    url.href.includes('playlist') ||
    url.href.includes('chunklist')
  ) {
    // লাইভ ভিডিও ডেটা সরাসরি নেটওয়ার্ক থেকে টানবে, কোনো ক্যাশ ইন্টারফেয়ারেন্স থাকবে না
    return;
  }

  // ২. লাইভ চ্যানেলের ডাটা ফাইলের জন্য (Stale-While-Revalidate পলিসি)
  if (url.pathname.endsWith('Channels_data.json') || url.href.includes('Channels_data.json')) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          // যদি ক্যাশে ডেটা থাকে তবে সেটি সাথে সাথে রিটার্ন করবে
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // নেটওয়ার্ক ফেইল করলে ক্যাশ রেসপন্স ব্যাকআপ হিসেবে কাজ করবে
          });
          
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // ৩. অন্যান্য স্ট্যাটিক ফাইল ও থার্ড পার্টি রিসোর্সের জন্য (Cache-First পলিসি)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return caches.open(RUNTIME_CACHE).then((cache) => {
        return fetch(event.request).then((response) => {
          // ইমেজ বা গুগল ফন্ট পাওয়া গেলে সেগুলো ক্যাশ করে নেওয়া
          if (response.status === 200 && (event.request.destination === 'image' || url.host.includes('unsplash') || url.host.includes('wikimedia'))) {
            cache.put(event.request, response.clone());
          }
          return response;
        }).catch(() => {
          // নেটওয়ার্ক এবং ক্যাশ দুটোই অফলাইন থাকলে ব্ল্যাঙ্ক বা সেফ রিটার্ন
        });
      });
    })
  );
});

```
