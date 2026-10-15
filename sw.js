/* Service worker — η εφαρμογή ανοίγει και χωρίς δίκτυο.
   Αλλαγή της ΕΚΔΟΣΗΣ σε κάθε δημοσίευση αλλάζει την κρυφή μνήμη· η νέα έκδοση ενεργοποιείται στο επόμενο άνοιγμα. */
const ΕΚΔΟΣΗ = "2026-10-15g";
const ΜΝΗΜΗ = "ερωτηματολόγια-" + ΕΚΔΟΣΗ;
const ΑΡΧΕΙΑ = [
  "./", "index.html", "στυλ.css", "εφαρμογή.js", "manifest.webmanifest",
  "ερωτήσεις_κοινές.json", "ερωτήσεις_οστική.json", "ερωτήσεις_λιπομέτρηση.json",
  "εικονίδια/εικονίδιο-180.png", "εικονίδια/εικονίδιο-192.png", "εικονίδια/εικονίδιο-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(ΜΝΗΜΗ).then(c => c.addAll(ΑΡΧΕΙΑ.map(a => new Request(a, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== ΜΝΗΜΗ).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Δίκτυο πρώτα (για να παίρνει ενημερώσεις όταν υπάρχει σύνδεση), αλλιώς κρυφή μνήμη.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => { if (r && r.ok) { const αντ = r.clone(); caches.open(ΜΝΗΜΗ).then(c => c.put(e.request, αντ)); } return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || (e.request.mode === "navigate" ? caches.match("index.html") : undefined)))
  );
});
