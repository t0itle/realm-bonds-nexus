import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const VAPID_PUBLIC_KEY = 'BOEGtg6roWfBHqQWdVabE3B4yaEEByIftXmER513uoE80Hgs12nQ8gDd8hs3m5GStXKHqouYo-x_M09s22O3LNA';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);

    // Don't register SW in iframes or preview hosts
    const isInIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
    const isPreview = window.location.hostname.includes('id-preview--') || window.location.hostname.includes('lovableproject.com');
    
    if (supported && !isInIframe && !isPreview) {
      navigator.serviceWorker.register('/sw.js').then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          // Check if existing subscription uses current VAPID key — if not, unsubscribe
          const existingKey = sub.options?.applicationServerKey;
          const currentKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
          if (existingKey) {
            const existingArr = new Uint8Array(existingKey as ArrayBuffer);
            if (existingArr.length !== currentKey.length || existingArr.some((v, i) => v !== currentKey[i])) {
              console.log('VAPID key changed, re-subscribing...');
              await sub.unsubscribe();
              setIsSubscribed(false);
              return;
            }
          }
        }
        setIsSubscribed(!!sub);
      }).catch(console.error);
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!user || !isSupported) return false;

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return false;

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      const subJson = sub.toJSON();
      
      // Save to database
      await supabase.from('push_subscriptions' as any).upsert({
        user_id: user.id,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys?.p256dh,
        auth: subJson.keys?.auth,
      }, { onConflict: 'user_id,endpoint' });

      setIsSubscribed(true);
      return true;
    } catch (e) {
      console.error('Push subscription error:', e);
      return false;
    }
  }, [user, isSupported]);

  const unsubscribe = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        if (user) {
          await supabase.from('push_subscriptions' as any).delete().eq('user_id', user.id).eq('endpoint', endpoint);
        }
      }
      setIsSubscribed(false);
      return true;
    } catch (e) {
      console.error('Push unsubscribe error:', e);
      return false;
    }
  }, [user]);

  return { permission, isSubscribed, isSupported, subscribe, unsubscribe };
}
