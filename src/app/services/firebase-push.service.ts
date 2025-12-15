import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class FirebasePushService {
  private readonly apiUrl = 'http://localhost:8081/api/v1';
  private platformId = inject(PLATFORM_ID);
  private app: FirebaseApp | null = null;
  private messaging: Messaging | null = null;

  constructor(private http: HttpClient) {}

  async init(): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId)) return false;

    try {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          console.log('Service worker registered:', registration.scope);
          await navigator.serviceWorker.ready;
          console.log('Service worker ready');
        } catch (swError) {
          console.error('Service worker registration failed:', swError);
          return false;
        }
      }
      this.app = initializeApp(environment.firebase);
      this.messaging = getMessaging(this.app);
      console.log('Firebase initialized');
      return true;
    } catch (error) {
      console.error('Firebase initialization failed:', error);
      return false;
    }
  }

  async requestPermissionAndGetToken(): Promise<string | null> {
    if (!this.messaging) {
      const initialized = await this.init();
      if (!initialized) {
        console.error('Firebase messaging not initialized');
        return null;
      }
    }

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      console.log('Notification permission:', permission);
      if (permission !== 'granted') {
        console.log('Notification permission denied');
        return null;
      }

      if (!environment.firebase.vapidKey) {
        console.error(
          'VAPID key is not configured! Get it from Firebase Console → Project Settings → Cloud Messaging → Web Push certificates'
        );
        return null;
      }

      console.log('Requesting FCM token with vapidKey...');
      const swRegistration = await navigator.serviceWorker.getRegistration(
        '/firebase-messaging-sw.js'
      );
      console.log('Using service worker registration:', swRegistration?.scope);

      if (!swRegistration) {
        console.error('Service worker registration not found');
        return null;
      }

      if (swRegistration.installing) {
        console.log('Waiting for service worker to install...');
        await new Promise<void>((resolve) => {
          swRegistration.installing!.addEventListener('statechange', (e) => {
            if ((e.target as ServiceWorker).state === 'activated') {
              resolve();
            }
          });
        });
      }

      const token = await getToken(this.messaging!, {
        vapidKey: environment.firebase.vapidKey,
        serviceWorkerRegistration: swRegistration,
      });

      if (!token) {
        console.error('No FCM token received from Firebase');
        return null;
      }

      console.log('FCM Token received:', token.substring(0, 20) + '...');
      return token;
    } catch (error: any) {
      if (error?.message?.includes('push service')) {
        console.error(
          'Push service error. On macOS, ensure notifications are enabled for your browser in System Settings → Notifications → [Your Browser]'
        );
      } else {
        console.error('Failed to get FCM token:', error);
      }
      return null;
    }
  }

  async subscribeToNotifications(): Promise<boolean> {
    const token = await this.requestPermissionAndGetToken();
    if (!token) return false;

    try {
      await this.http
        .post(`${this.apiUrl}/users/fcm/token`, { token }, { withCredentials: true })
        .toPromise();

      console.log('FCM token sent to server');

      if (this.messaging) {
        onMessage(this.messaging, (payload) => {
          console.log('Foreground message received:', payload);
          if (payload.notification) {
            new Notification(payload.notification.title || 'Object Tracker', {
              body: payload.notification.body,
              icon: '/favicon.ico',
            });
          }
        });
      }

      return true;
    } catch (error) {
      console.error('Failed to subscribe:', error);
      return false;
    }
  }
}
