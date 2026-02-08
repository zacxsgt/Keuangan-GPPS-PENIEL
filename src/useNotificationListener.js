import { useEffect } from 'react';
import { ref, onChildAdded, query, orderByChild, startAt } from 'firebase/database';
import { database } from './firebase';

export const useNotificationListener = (user, addNotification) => {
  useEffect(() => {
    if (!user) return;

    const notificationsRef = ref(database, 'notifications');
    const now = Date.now();
    
    // Listen hanya untuk notifikasi yang dibuat setelah user login
    const recentNotificationsQuery = query(
      notificationsRef,
      orderByChild('timestamp'),
      startAt(now)
    );

    const unsubscribe = onChildAdded(recentNotificationsQuery, (snapshot) => {
      const notification = snapshot.val();
      
      if (!notification) return;

      // Show in-app notification
      addNotification(notification.title, notification.body);

      // Show browser notification
      if (Notification.permission === 'granted') {
        const notif = new Notification(notification.title, {
          body: notification.body,
          icon: '/logo-gpps.jpeg',
          badge: '/logo-gpps.jpeg',
          tag: snapshot.key,
          requireInteraction: false,
          silent: false
        });

        // Auto close after 5 seconds
        setTimeout(() => notif.close(), 5000);

        // Play sound (optional)
        try {
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSyDzPLTgjMHHGS57OihUBELTKXh8bllHAU2jdXxzn0vBSh+zPDhkT4JFmK28OekUxEJS6Lf8bllHAU2jdXxzn0vBSh+zPDhkT4JFmK28OekUxEJS6Lf8bllHAU2jdXxzn0vBSh+zPDhkT4JFmK28OekUxEJS6Lf8bllHAU2jdXxzn0vBSh+zPDhkT4JFmK28OekUxEJS6Lf8bllHAU2jdXxzn0vBSh+zPDhkT4JFmK28OekUxEJS6Lf8bllHAU2jdXxzn0vBSh+zPDhkT4JFmK28OekUxEJS6Lf8bllHAU2jdXxzn0vBSh+zPDhkT4JFmK28OekUxEJS6Lf8bllHAU2jdXxzn0vBSh+zPDhkT4JFmK28OekUxEJS6Lf8bllHAU2jdXxzn0vBSh+zPDhkT4JFmK28OekUxEJS6Lf8Q==');
          audio.play().catch(() => {});
        } catch (e) {}
      }
    });

    return () => unsubscribe();
  }, [user, addNotification]);
};