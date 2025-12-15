import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class PushService {
  private readonly apiUrl = 'http://localhost:8081/api/v1';
  private readonly vapidPublicKey =
    'BCeBmScKmAEJQtNCWG_wdgghmxU4xxeTPKQBub4_f32xZF9gkzz6X9OO58T6P7AVtfL1qCC2zixlP1R5dE0ziyA';
  private platformId = inject(PLATFORM_ID);
  private swRegistration: ServiceWorkerRegistration | null = null;

  constructor(private http: HttpClient) {}

  async init(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications not supported');
      return;
    }

    try {
      this.swRegistration = await navigator.serviceWorker.register('/sw-push.js');
      console.log('Service Worker registered:', this.swRegistration);

      await navigator.serviceWorker.ready;
      console.log('Service Worker is ready');
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }

  async subscribe(): Promise<boolean> {
    if (!this.swRegistration) {
      await this.init();
    }

    if (!this.swRegistration) {
      console.error('No service worker registration');
      return false;
    }

    try {
      let subscription = await this.swRegistration.pushManager.getSubscription();
      console.log('Existing subscription:', subscription);

      if (!subscription) {
        const applicationServerKey = this.urlBase64ToUint8Array(this.vapidPublicKey);
        console.log('Subscribing with VAPID key...');
        subscription = await this.swRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as BufferSource,
        });
        console.log('Push subscription created:', subscription);
      }

      const subscriptionJson = subscription.toJSON();
      console.log('Sending subscription to server:', subscriptionJson);

      await this.http
        .post(`${this.apiUrl}/users/push/subscribe`, subscriptionJson, { withCredentials: true })
        .toPromise();

      console.log('Push subscription sent to server successfully');
      return true;
    } catch (error) {
      console.error('Failed to subscribe to push:', error);
      return false;
    }
  }

  async unsubscribe(): Promise<void> {
    if (!this.swRegistration) return;

    try {
      const subscription = await this.swRegistration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await this.http
          .delete(`${this.apiUrl}/users/push/subscribe`, { withCredentials: true })
          .toPromise();
        console.log('Unsubscribed from push notifications');
      }
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
    }
  }

  async isSubscribed(): Promise<boolean> {
    if (!this.swRegistration) return false;
    const subscription = await this.swRegistration.pushManager.getSubscription();
    return subscription !== null;
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}
