importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// ⚠️ GANTI dengan Firebase Config yang SAMA seperti di firebase.js
firebase.initializeApp({
    apiKey: "AIzaSyA3HSWbhpBMa-mGiAvbEWVs0riHL0qvee8",
    authDomain: "gpps-peniel-finances.firebaseapp.com",
    databaseURL: "https://gpps-peniel-finances-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "gpps-peniel-finances",
    storageBucket: "gpps-peniel-finances.firebasestorage.app",
    messagingSenderId: "638248588868",
    appId: "1:638248588868:web:56a3d67b85f520fc458e11",
});
const messaging = firebase.messaging();

// Handle background notifications
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);
    
    const notificationTitle = payload.notification?.title || 'GPPS PENIEL';
    const notificationOptions = {
        body: payload.notification?.body || 'Ada pemberitahuan baru',
        icon: '/logo-gpps.jpeg',
        badge: '/logo-gpps.jpeg',
        tag: 'gpps-notification',
        requireInteraction: true,
        data: payload.data
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
    });

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/')
    );
});