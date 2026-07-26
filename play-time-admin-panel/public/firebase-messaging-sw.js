// Service Worker for Firebase Cloud Messaging
// This file must be in the public directory

importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
// Note: You'll need to provide your Firebase config here
const firebaseConfig = {
  apiKey: "AIzaSyA_VF4VE48QsNTwoq6XMP1gZ_mA4utbkmg",
  authDomain: "playtime-d9b83.firebaseapp.com",
  projectId: "playtime-d9b83",
  storageBucket: "playtime-d9b83.firebasestorage.app",
  messagingSenderId: "721347779964",
  appId: "1:721347779964:web:c1af6a9d7116d7b1bed8f9"
};

firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || '',
    image: payload.notification?.image || payload.data?.imageUrl,
    tag: payload.data?.notificationId || 'notification',
    data: payload.data,
    requireInteraction: false,
    silent: false
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received.');

  event.notification.close();

  // Get action URL from notification data
  const actionUrl = event.notification.data?.actionUrl || '/notifications';
  const targetUrl = actionUrl.startsWith('/')
    ? new URL(`/#${actionUrl}`, self.location.origin).href
    : new URL('/#/notifications', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          if ('navigate' in client) {
            await client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      return clients.openWindow ? clients.openWindow(targetUrl) : undefined;
    })
  );
});

