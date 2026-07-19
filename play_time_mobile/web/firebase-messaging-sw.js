importScripts("https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyA1-1pN_CgHsOqJN--ShyrH7BfwrTTSPzU",
  authDomain: "playtime-d9b83.firebaseapp.com",
  projectId: "playtime-d9b83",
  storageBucket: "playtime-d9b83.firebasestorage.app",
  messagingSenderId: "721347779964",
  appId: "1:721347779964:web:0000000000000000000000"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icons/Icon-192.png'
  };

  self.registration.showNotification(notificationTitle,
    notificationOptions);
});
