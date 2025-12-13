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
      // Initialize Firebase
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
      if (!initialized) return null;
    }

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('Notification permission denied');
        return null;
      }

      // Get FCM token
      const token = await getToken(this.messaging!, {
        vapidKey: environment.firebase.vapidKey,
      });

      console.log('FCM Token:', token);
      return token;
    } catch (error) {
      console.error('Failed to get FCM token:', error);
      return null;
    }
  }

  async subscribeToNotifications(): Promise<boolean> {
    const token = await this.requestPermissionAndGetToken();
    if (!token) return false;

    try {
      // Send token to backend
      await this.http
        .post(`${this.apiUrl}/users/fcm/token`, { token }, { withCredentials: true })
        .toPromise();

      console.log('FCM token sent to server');

      // Listen for foreground messages
      if (this.messaging) {
        onMessage(this.messaging, (payload) => {
          console.log('Foreground message received:', payload);
          // Show notification manually for foreground
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
