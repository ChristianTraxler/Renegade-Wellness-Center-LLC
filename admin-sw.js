// Service worker for the installed admin dashboard (admin.html). Push only: no caching.
// Payload from the notify-booking Edge Function: { title, body, badge, tag, url }.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (e) => {
  let d = {}
  try { d = (e.data && e.data.json()) || {} } catch (err) {}
  const title = d.title || 'New booking'
  const nav = self.navigator
  // No badge field means the server could not read the unread count: leave the icon alone.
  const hasBadge = d.badge !== undefined && d.badge !== null
  const badge = Number(d.badge) || 0
  const setBadge = Promise.resolve().then(() => {
    if (!hasBadge) return null
    if (badge > 0 && nav.setAppBadge) return nav.setAppBadge(badge)
    return nav.clearAppBadge ? nav.clearAppBadge() : null
  })
  e.waitUntil(Promise.all([
    self.registration.showNotification(title, { body: d.body || 'Someone booked online', tag: d.tag, icon: 'assets/images/maskable_icon_x192.png', data: { url: d.url || './admin.html?bell=1' } }),
    setBadge.catch(() => {}),
  ]))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = new URL((e.notification.data && e.notification.data.url) || './admin.html?bell=1', self.registration.scope).href
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
    const win = wins.find((w) => w.url.startsWith(self.registration.scope))
    if (win) return win.navigate(url).then((w) => (w || win).focus()).catch(() => win.focus().catch(() => self.clients.openWindow(url)))
    return self.clients.openWindow(url)
  }))
})
