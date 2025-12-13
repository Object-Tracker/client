import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subject } from 'rxjs';
import { LocationBroadcast, Notification } from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class WebSocketService {
  private locationClient: any = null;
  private notificationClient: any = null;
  private platformId = inject(PLATFORM_ID);

  locationUpdates$ = new Subject<LocationBroadcast>();
  notifications$ = new Subject<Notification>();

  isConnected = signal(false);
  notificationCount = signal(0);

  async connectLocations(userId: number): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    const { Client } = await import('@stomp/stompjs');
    const SockJS = (await import('sockjs-client')).default;

    this.locationClient = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8082/ws'),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });

    this.locationClient.onConnect = () => {
      console.log('Connected to location WebSocket');
      this.isConnected.set(true);

      this.locationClient.subscribe(`/topic/locations/${userId}`, (message: any) => {
        const update = JSON.parse(message.body);
        this.locationUpdates$.next(update);
      });
    };

    this.locationClient.onDisconnect = () => {
      console.log('Disconnected from location WebSocket');
      this.isConnected.set(false);
    };

    this.locationClient.activate();
  }

  async connectNotifications(userId: number): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    const { Client } = await import('@stomp/stompjs');
    const SockJS = (await import('sockjs-client')).default;

    this.notificationClient = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8083/ws-notifications'),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });

    this.notificationClient.onConnect = () => {
      console.log('Connected to notification WebSocket');

      this.notificationClient.subscribe(`/topic/notifications/${userId}`, (message: any) => {
        console.log('Received notification:', message.body);
        const notification = JSON.parse(message.body);
        this.notifications$.next(notification);
        this.notificationCount.update((count) => count + 1);
      });
    };

    this.notificationClient.onStompError = (frame: any) => {
      console.error('Notification WebSocket STOMP error:', frame);
    };

    this.notificationClient.onWebSocketError = (event: any) => {
      console.error('Notification WebSocket error:', event);
    };

    this.notificationClient.activate();
  }

  disconnect(): void {
    if (this.locationClient) {
      this.locationClient.deactivate();
      this.locationClient = null;
    }
    if (this.notificationClient) {
      this.notificationClient.deactivate();
      this.notificationClient = null;
    }
    this.isConnected.set(false);
  }

  clearNotifications(): void {
    this.notificationCount.set(0);
  }
}
