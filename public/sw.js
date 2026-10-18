// Shows the site's announcements as notifications (push_notices.py sends
// them). Nothing here touches page loads: there is no fetch handler.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let message = {};
  try { message = event.data ? event.data.json() : {}; } catch { message = {body: event.data?.text() || ''}; }
  event.waitUntil(self.registration.showNotification(message.title || 'PropScout', {
    body: message.body || '',
    icon: '/icons/icon-192.png?v=6',
    badge: '/icons/icon-192.png?v=6',
    tag: message.tag || 'announcement',
    data: {url: message.url || '/'},
  }));
});

// A tap on the notification brings the app forward where it was, or opens
// it; an announcement with its own link goes there.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  const url = new URL(target, self.location.origin).href;
  event.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(windows => {
    const open = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (!open) return self.clients.openWindow(url);
    return open.focus().then(client => (target !== '/' && client?.navigate ? client.navigate(url) : client));
  }));
});
