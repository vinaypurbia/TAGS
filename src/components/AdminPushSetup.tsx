import { useState, useEffect } from 'react';
import { Bell, BellOff, CheckCircle, AlertCircle, Loader } from 'lucide-react';

// VAPID public key from your .env — must match VAPID_PUBLIC_KEY on server
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export default function AdminPushSetup() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'subscribed' | 'unsupported' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setStatus('unsupported');
      return;
    }
    if (Notification.permission === 'granted') {
      checkExistingSubscription();
    }
  }, []);

  const checkExistingSubscription = async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration('/delivery-sw.js');
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) setStatus('subscribed');
      }
    } catch {}
  };

  const handleSubscribe = async () => {
    setStatus('loading');
    setErrorMsg('');
    try {
      if (!VAPID_PUBLIC_KEY) throw new Error('VITE_VAPID_PUBLIC_KEY not set in .env');

      // Register service worker
      const reg = await navigator.serviceWorker.register('/delivery-sw.js');
      await navigator.serviceWorker.ready;

      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Permission denied');

      // Subscribe to push
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Save to server
      const res = await fetch('/api/sales', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'push-setup',
          action: 'push_subscribe',
          subscription: subscription.toJSON(),
          adminId: 'admin-pc',
        }),
      });

      if (!res.ok) throw new Error('Failed to save subscription');
      setStatus('subscribed');
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to enable notifications');
      setStatus('error');
    }
  };

  const handleUnsubscribe = async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration('/delivery-sw.js');
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
      }
      setStatus('idle');
    } catch {}
  };

  if (status === 'unsupported') {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm">
        <BellOff className="w-4 h-4" />
        <span>Push notifications not supported in this browser.</span>
      </div>
    );
  }

  if (status === 'subscribed') {
    return (
      <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <div>
            <p className="text-sm font-semibold text-green-800">Delivery notifications ON</p>
            <p className="text-xs text-green-600">You'll get a pop-up on this PC when orders are delivered.</p>
          </div>
        </div>
        <button onClick={handleUnsubscribe} className="text-xs text-gray-400 hover:text-red-500 ml-4">
          Disable
        </button>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Bell className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Enable Delivery Notifications</p>
            <p className="text-xs text-blue-600 mt-0.5">
              Get a browser pop-up on this PC whenever a delivery is confirmed. Free — no Firebase needed.
            </p>
            {status === 'error' && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errorMsg}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleSubscribe}
          disabled={status === 'loading'}
          className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5"
        >
          {status === 'loading' ? (
            <><Loader className="w-3.5 h-3.5 animate-spin" /> Setting up...</>
          ) : (
            <><Bell className="w-3.5 h-3.5" /> Enable</>
          )}
        </button>
      </div>
    </div>
  );
}
