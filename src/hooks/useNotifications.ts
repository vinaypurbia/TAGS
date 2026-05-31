import { useEffect } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyCnf9zvt-ugfi-2O7vh_gnu2xBBGDutgjk",
  authDomain: "tags-1b80a.firebaseapp.com",
  projectId: "tags-1b80a",
  storageBucket: "tags-1b80a.firebasestorage.app",
  messagingSenderId: "224517071102",
  appId: "1:224517071102:web:79c9f72ee36c5657f805af"
};

const VAPID_KEY = "BFVSQgcsTzgqThlIZipl6fJEpfD94TvFJQD7gUIAMxl_MnwxCE4-5AvHa68fLL1RTQEcCxXUQhyqqiobwixDNzg";

// Initialize Firebase only once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export async function requestNotificationPermission(): Promise<string | null> {
  try {
    if (!('Notification' in window)) return null;
    if (!('serviceWorker' in navigator)) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });

    if (token) {
      await fetch('/api/business?module=notifications&action=save-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      }).catch(() => {});
    }

    return token;
  } catch (err) {
    console.error('Notification permission error:', err);
    return null;
  }
}

// FIX: accepts `ready` param so it waits for SW before initializing Firebase messaging
export function useFirebaseNotifications(ready: boolean = true) {
  useEffect(() => {
    // Don't initialize until SW is ready — prevents grey screen crash
    if (!ready) return;
    if (!('serviceWorker' in navigator)) return;

    let unsubscribe: (() => void) | null = null;

    try {
      const messaging = getMessaging(app);

      unsubscribe = onMessage(messaging, (payload) => {
        const { title, body } = payload.notification || {};
        if (title && Notification.permission === 'granted') {
          new Notification(title, {
            body: body || '',
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
          });
        }
      });
    } catch (err) {
      // Fail silently — notifications are non-critical
      console.warn('Firebase messaging init error:', err);
    }

    return () => { if (unsubscribe) unsubscribe(); };
  }, [ready]); // re-runs when ready flips to true
}
