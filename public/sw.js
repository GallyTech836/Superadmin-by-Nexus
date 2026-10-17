// Service worker mínimo de Nexus Control: solo lo necesario para que se
// pueda instalar como app. NO guarda nada en caché, así siempre se ve la
// última versión publicada y los datos en vivo de Firebase.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* red directa, sin caché */ });
