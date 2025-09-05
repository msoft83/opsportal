const CACHE_NAME = "opsportal-v1";
const urlsToCache = [
  "index.html",
  "StationDisplay.html",
  "StationSetup.html",
  "AssignedStations.html",
  "DataManager.html",
  "TrainingPath.html",
  "AddLS.html",
  "SeedData.html"
];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});
self.addEventListener("fetch", event => {
  event.respondWith(caches.match(event.request).then(response => response || fetch(event.request)));
});
