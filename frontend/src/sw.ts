/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkOnly, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
const CACHEABLE_STATUS = 200;
import { PWA } from './pwa/pwa.constants';
declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api\//, /\/[^/?]+\.[^/]+$/],
  }),
);
registerRoute(({ url }) => url.pathname.startsWith('/api/'), new NetworkOnly());
registerRoute(
  ({ request, url }) =>
    request.destination === 'image' && url.origin === self.location.origin && url.pathname.startsWith('/icons/'),
  new CacheFirst({
    cacheName: PWA.imageCache,
    plugins: [
      new ExpirationPlugin({ maxEntries: PWA.imageEntries, maxAgeSeconds: PWA.imageAgeSeconds }),
      {
        /** Cache only successful public icon responses without personalized cache directives.
         * @param {object} context - Workbox response context.
         * @returns {object} Operation result. */
        cacheWillUpdate: async ({ response }) =>
          response.status === CACHEABLE_STATUS &&
          !/no-store|private/i.test(response.headers.get('Cache-Control') ?? '') &&
          !response.headers.has('Vary')
            ? response
            : null,
      },
    ],
  }),
);
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});
self.addEventListener('push', (event) => {
  let payload = { title: 'Folio reminder', body: 'An upcoming transaction needs your attention.', tag: 'folio' };
  try {
    payload = { ...payload, ...event.data?.json() };
  } catch {
    /* Invalid push content uses safe defaults. */
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: PWA.icon192,
      badge: PWA.icon192,
      data: { url: '/calendar' },
    }),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow('/calendar'));
});
