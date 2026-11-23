const cachePrefix = "hibi-techou-shell-";
const cacheName = cachePrefix + "1";
const appFiles = [
  "./", "styles.css", "app.mjs", "calendar.mjs", "storage.mjs",
  "manifest.webmanifest", "icon-192.png", "icon-512.png",
].map((file) => new URL(file, self.registration.scope).href);

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    const responses = await Promise.all(appFiles.map((url) => fetch(url, { cache: "reload" })));
    if (responses.some((response) => !response.ok || response.redirected)) {
      throw new Error("Offline resources could not be downloaded");
    }
    await Promise.all(responses.map((response, index) => cache.put(appFiles[index], response)));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(cachePrefix) && name !== cacheName)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate" && (url.href.split("?")[0] === self.registration.scope ||
      url.href.split("?")[0] === new URL("index.html", self.registration.scope).href)) {
    event.respondWith(fetch(event.request).catch(async () => {
      const cache = await caches.open(cacheName);
      return (await cache.match(appFiles[0])) ?? Response.error();
    }));
    return;
  }
  if (appFiles.includes(url.href)) {
    event.respondWith((async () => {
      const cache = await caches.open(cacheName);
      return (await cache.match(event.request)) ?? fetch(event.request);
    })());
  }
});
