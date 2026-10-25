// Kalendae offline cache. Bump VERSION whenever you change a file so phones pick up the update.
const VERSION = "kalendae-v9";
const FILES = ["./", "index.html", "manifest.webmanifest", "js/i18n.js", "js/store.js", "js/money.js", "js/banks.js", "js/items.js", "js/subs.js", "js/ui.js", "js/accounts.js", "js/commit.js", "js/spend.js", "js/today.js", "js/forecast.js", "js/charts.js", "js/checkin.js", "js/notify.js", "js/settings.js", "js/app.js",
  "js/i18n/pl.js", "js/i18n/de.js", "js/i18n/uk.js", "js/i18n/es.js", "js/i18n/fr.js", "js/i18n/ru.js", "js/i18n/zh.js", "js/i18n/ja.js", "js/i18n/pt.js", "js/i18n/nl.js", "js/i18n/it.js", "js/i18n/hi.js", "js/i18n/ar.js", "js/i18n/el.js", "js/i18n/cs.js", "js/i18n/sv.js",
  "js/i18n/ko.js", "js/i18n/id.js", "js/i18n/bn.js", "js/i18n/tr.js", "js/i18n/te.js", "js/i18n/ro.js", "js/i18n/hu.js", "js/i18n/fi.js", "js/i18n/no.js", "js/i18n/sk.js", "js/i18n/sw.js", "js/i18n/fa.js", "js/i18n/da.js", "js/i18n/th.js", "js/i18n/vi.js", "js/i18n/bg.js",
  "icons/icon.js", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(FILES.map(f => c.add(f).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// network first, so updates show up straight away; fall back to the cache when offline.
// Exchange-rate requests (another site) are never cached here; the app keeps its own copy.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request).then(r => r || caches.match("index.html")))
  );
});
