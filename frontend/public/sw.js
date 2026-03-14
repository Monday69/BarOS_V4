/**
 * BarOS V4 — Service Worker
 * Chemin : public/sw.js
 *
 * Gère :
 *   - Réception des push notifications (quand le user est hors app)
 *   - Clic sur la notif → ouvre /queue
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

// ── Réception d'une notification push ────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'BarOS', body: event.data.text() };
  }

  const options = {
    body:    payload.body  || "Votre cocktail vous attend !",
    icon:    '/logo192.png',
    badge:   '/logo192.png',
    vibrate: [200, 100, 200],
    tag:     'baros-queue',        // remplace la notif précédente si pas encore lue
    renotify: true,
    data: {
      url:      '/queue',
      entry_id: payload.data?.entry_id,
    },
    actions: [
      { action: 'confirm', title: '🍹 Confirmer sur la machine' },
      { action: 'dismiss', title: 'Plus tard' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || "BarOS — C'est votre tour !", options)
  );
});

// ── Clic sur la notification ──────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/queue';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Si l'app est déjà ouverte → focus + naviguer
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Sinon → ouvrir un nouvel onglet
      return clients.openWindow(url);
    })
  );
});