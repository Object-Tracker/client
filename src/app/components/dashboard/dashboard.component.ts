import { Component, OnInit, OnDestroy, signal, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ObjectService } from '../../services/object.service';
import { LocationService } from '../../services/location.service';
import { WebSocketService } from '../../services/websocket.service';
import { FirebasePushService } from '../../services/firebase-push.service';
import { TrackedObject, TrackedObjectRequest, Notification as AppNotification } from '../../models/user.model';

declare const L: any;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private map: any;
  private markers: Map<number, any> = new Map();
  private geofenceCircle: any;
  private subscriptions: Subscription[] = [];

  objects = signal<TrackedObject[]>([]);
  notifications = signal<AppNotification[]>([]);
  showAddModal = signal(false);
  showGeofenceModal = signal(false);
  selectedObject = signal<TrackedObject | null>(null);
  isSimulating = signal(false);
  notificationPermission = signal<NotificationPermission>('default');

  // Form fields
  newObjectName = '';
  newObjectIcon = '';
  geofenceLat = 0;
  geofenceLng = 0;
  geofenceRadius = 500;

  // Simulation settings
  simulationStepMeters = 10; // meters per step
  simulationIntervalMs = 200; // milliseconds between steps
  simulationTotalSteps = 30; // total number of steps

  // Predefined object types with emojis
  objectPresets = [
    { name: 'Keys', icon: '🔑', type: 'KEYS' },
    { name: 'Bicycle', icon: '🚲', type: 'BICYCLE' },
    { name: 'Backpack', icon: '🎒', type: 'BAG' },
    { name: 'Laptop', icon: '💻', type: 'LAPTOP' },
    { name: 'Phone', icon: '📱', type: 'PHONE' },
    { name: 'Wallet', icon: '👛', type: 'OTHER' },
    { name: 'Car', icon: '🚗', type: 'OTHER' },
    { name: 'Pet', icon: '🐕', type: 'OTHER' },
    { name: 'Watch', icon: '⌚', type: 'OTHER' },
    { name: 'Headphones', icon: '🎧', type: 'OTHER' },
    { name: 'Camera', icon: '📷', type: 'OTHER' },
    { name: 'Umbrella', icon: '☂️', type: 'OTHER' },
  ];

  selectedPreset: { name: string; icon: string; type: string } | null = null;

  constructor(
    public authService: AuthService,
    private objectService: ObjectService,
    private locationService: LocationService,
    public webSocketService: WebSocketService,
    private firebasePushService: FirebasePushService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService.checkAuth().subscribe((user) => {
      if (!user) {
        this.router.navigate(['/auth']);
        return;
      }

      if (isPlatformBrowser(this.platformId)) {
        this.initMap();
        this.loadObjects();
        this.setupWebSocket();
        this.refreshFcmToken(); // Always refresh FCM token on dashboard load

        if (user.geofenceCenterLat && user.geofenceCenterLng) {
          this.geofenceLat = user.geofenceCenterLat;
          this.geofenceLng = user.geofenceCenterLng;
          this.geofenceRadius = user.geofenceRadiusMeters || 500;
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.webSocketService.disconnect();
    if (this.map) {
      this.map.remove();
    }
  }

  private async initMap(): Promise<void> {
    const L = await import('leaflet');

    // Default center (can be changed to user's location)
    const defaultLat = 46.77;
    const defaultLng = 23.59;

    this.map = L.map('map').setView([defaultLat, defaultLng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);

    // Get user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          this.map.setView([lat, lng], 14);

          if (!this.geofenceLat && !this.geofenceLng) {
            this.geofenceLat = lat;
            this.geofenceLng = lng;
          }
        },
        () => {
          console.log('Could not get user location');
        }
      );
    }

    this.map.on('click', (e: any) => {
      if (this.selectedObject()) {
        this.updateObjectLocation(e.latlng.lat, e.latlng.lng);
      }
    });

    this.drawGeofence();
  }

  private async drawGeofence(): Promise<void> {
    const user = this.authService.currentUser();
    if (!user?.geofenceCenterLat || !user?.geofenceCenterLng) return;

    const L = await import('leaflet');

    if (this.geofenceCircle) {
      this.map.removeLayer(this.geofenceCircle);
    }

    this.geofenceCircle = L.circle([user.geofenceCenterLat, user.geofenceCenterLng], {
      color: '#3b82f6',
      fillColor: '#3b82f6',
      fillOpacity: 0.1,
      radius: user.geofenceRadiusMeters || 500,
    }).addTo(this.map);
  }

  private loadObjects(): void {
    this.objectService.getObjects().subscribe((objects) => {
      this.objects.set(objects);
      this.updateMarkers(objects);
    });
  }

  private async updateMarkers(objects: TrackedObject[]): Promise<void> {
    if (!this.map) return; // Guard against map not being initialized

    const L = await import('leaflet');

    // Clear old markers
    this.markers.forEach((marker) => this.map.removeLayer(marker));
    this.markers.clear();

    objects.forEach((obj) => {
      if (obj.latitude && obj.longitude) {
        const emoji = this.getObjectEmoji(obj);
        const borderColor = obj.outsideGeofence ? '#ef4444' : '#22c55e';
        const icon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="width: 40px; height: 40px; border-radius: 50%; background: white; border: 3px solid ${borderColor}; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 2px 6px rgba(0,0,0,0.3);" title="${obj.name}">
            ${emoji}
          </div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });

        const marker = L.marker([obj.latitude, obj.longitude], { icon })
          .addTo(this.map)
          .bindPopup(`<div style="text-align: center;"><span style="font-size: 24px;">${emoji}</span><br><b>${obj.name}</b><br>${obj.outsideGeofence ? '<span style="color: #ef4444;">Outside safe zone!</span>' : '<span style="color: #22c55e;">Inside safe zone</span>'}</div>`);

        this.markers.set(obj.id, marker);
      }
    });
  }

  getObjectEmoji(obj: TrackedObject): string {
    if (obj.icon) return obj.icon;
    // Fallback based on type
    const fallbackIcons: Record<string, string> = {
      KEYS: '🔑',
      BICYCLE: '🚲',
      BAG: '🎒',
      LAPTOP: '💻',
      PHONE: '📱',
      OTHER: '📍',
    };
    return fallbackIcons[obj.type] || '📍';
  }

  private setupWebSocket(): void {
    const user = this.authService.currentUser();
    if (!user) return;

    this.webSocketService.connectLocations(user.userId);
    this.webSocketService.connectNotifications(user.userId);

    const locationSub = this.webSocketService.locationUpdates$.subscribe((update) => {
      this.objects.update((objects) =>
        objects.map((obj) =>
          obj.id === update.objectId
            ? { ...obj, latitude: update.latitude, longitude: update.longitude, outsideGeofence: update.outsideGeofence }
            : obj
        )
      );
      this.updateMarkers(this.objects());
    });

    const notificationSub = this.webSocketService.notifications$.subscribe((notification) => {
      this.notifications.update((n) => [notification, ...n].slice(0, 10));
      // Reload objects to get updated outsideGeofence status
      this.loadObjects();
      // Show browser push notification
      this.showBrowserNotification(notification);
    });

    this.subscriptions.push(locationSub, notificationSub);
  }

  selectObject(obj: TrackedObject): void {
    if (this.selectedObject()?.id === obj.id) {
      this.selectedObject.set(null);
    } else {
      this.selectedObject.set(obj);
      if (obj.latitude && obj.longitude) {
        this.map.setView([obj.latitude, obj.longitude], 15);
      }
    }
  }

  private updateObjectLocation(lat: number, lng: number): void {
    const obj = this.selectedObject();
    if (!obj) return;

    this.locationService
      .updateLocation({
        objectId: obj.id,
        latitude: lat,
        longitude: lng,
      })
      .subscribe(() => {
        this.selectedObject.set(null);
        // Reload objects to update the map immediately
        this.loadObjects();
      });
  }

  openAddModal(): void {
    this.selectedObject.set(null); // Clear any selected object first
    this.newObjectName = '';
    this.newObjectIcon = '';
    this.selectedPreset = null;
    this.showAddModal.set(true);
  }

  selectPreset(preset: { name: string; icon: string; type: string }): void {
    this.selectedPreset = preset;
    this.newObjectName = preset.name;
    this.newObjectIcon = preset.icon;
  }

  addObject(): void {
    if (!this.newObjectName || !this.newObjectIcon) return;

    const request: TrackedObjectRequest = {
      name: this.newObjectName,
      type: this.selectedPreset?.type || 'OTHER',
      icon: this.newObjectIcon,
    };

    this.objectService.createObject(request).subscribe(() => {
      this.showAddModal.set(false);
      this.loadObjects();
      this.authService.loadCurrentUser();
    });
  }

  deleteObject(obj: TrackedObject): void {
    if (confirm(`Delete "${obj.name}"?`)) {
      this.objectService.deleteObject(obj.id).subscribe(() => {
        this.loadObjects();
        this.authService.loadCurrentUser();
        if (this.selectedObject()?.id === obj.id) {
          this.selectedObject.set(null);
        }
      });
    }
  }

  openGeofenceModal(): void {
    const user = this.authService.currentUser();
    if (user?.geofenceCenterLat) {
      this.geofenceLat = user.geofenceCenterLat;
      this.geofenceLng = user.geofenceCenterLng!;
      this.geofenceRadius = user.geofenceRadiusMeters || 500;
    }
    this.showGeofenceModal.set(true);
  }

  saveGeofence(): void {
    this.objectService
      .updateGeofence({
        centerLat: this.geofenceLat,
        centerLng: this.geofenceLng,
        radiusMeters: this.geofenceRadius,
      })
      .subscribe(() => {
        this.showGeofenceModal.set(false);
        this.authService.loadCurrentUser();
        setTimeout(() => this.drawGeofence(), 100);
      });
  }

  useCurrentLocation(): void {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        this.geofenceLat = position.coords.latitude;
        this.geofenceLng = position.coords.longitude;
      });
    }
  }

  simulateMovement(obj: TrackedObject): void {
    if (!obj.latitude || !obj.longitude) {
      alert('Please set initial location by clicking on the map first');
      return;
    }

    const user = this.authService.currentUser();
    if (!user?.geofenceCenterLat || !user?.geofenceRadiusMeters) {
      alert('Please configure a Safe Zone first');
      return;
    }

    this.isSimulating.set(true);
    let step = 0;

    // Random direction for this simulation
    const randomAngle = Math.random() * 2 * Math.PI;

    // Start from current object position
    let currentLat = obj.latitude;
    let currentLng = obj.longitude;

    const interval = setInterval(() => {
      if (step >= this.simulationTotalSteps) {
        clearInterval(interval);
        this.isSimulating.set(false);
        return;
      }

      // Move object step by step in the random direction
      // Convert meters to degrees (approximate)
      const stepDegrees = this.simulationStepMeters / 111000;

      currentLat += stepDegrees * Math.cos(randomAngle);
      currentLng += stepDegrees * Math.sin(randomAngle) / Math.cos(currentLat * Math.PI / 180);

      this.locationService
        .updateLocation({
          objectId: obj.id,
          latitude: currentLat,
          longitude: currentLng,
        })
        .subscribe(() => {
          this.loadObjects(); // Update markers after each move
        });

      step++;
    }, this.simulationIntervalMs);
  }

  logout(): void {
    this.authService.logout().subscribe(() => {
      this.webSocketService.disconnect();
      this.router.navigate(['/auth']);
    });
  }

  clearNotification(index: number): void {
    this.notifications.update((n) => n.filter((_, i) => i !== index));
  }

  private async refreshFcmToken(): Promise<void> {
    // Update notification permission status
    if ('Notification' in window) {
      this.notificationPermission.set(Notification.permission);
    }

    // Always try to refresh FCM token if permission is granted
    if (Notification.permission === 'granted') {
      const success = await this.firebasePushService.subscribeToNotifications();
      if (success) {
        console.log('FCM token refreshed successfully');
      }
    }
  }

  async enablePushNotifications(): Promise<void> {
    const success = await this.firebasePushService.subscribeToNotifications();
    if (success) {
      this.notificationPermission.set('granted');
      console.log('Successfully subscribed to Firebase push notifications');
    } else {
      this.notificationPermission.set(Notification.permission);
    }
  }

  private showBrowserNotification(notification: AppNotification): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      const icon = notification.type === 'GEOFENCE_EXIT' ? '🚨' : '✅';
      const browserNotification = new window.Notification(`${icon} Object Tracker`, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: `notification-${notification.objectId}`,
        requireInteraction: notification.type === 'GEOFENCE_EXIT',
      });

      // Auto-close after 5 seconds for non-critical notifications
      if (notification.type !== 'GEOFENCE_EXIT') {
        setTimeout(() => browserNotification.close(), 5000);
      }

      // Focus window when notification is clicked
      browserNotification.onclick = () => {
        window.focus();
        browserNotification.close();
      };
    }
  }
}
