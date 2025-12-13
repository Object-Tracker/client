export interface User {
  userId: number;
  username: string;
  email: string;
  geofenceCenterLat?: number;
  geofenceCenterLng?: number;
  geofenceRadiusMeters?: number;
  trackedObjects: TrackedObject[];
}

export interface TrackedObject {
  id: number;
  name: string;
  type: string;
  icon?: string;
  latitude?: number;
  longitude?: number;
  outsideGeofence: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  userPassword: string;
  email: string;
}

export interface TrackedObjectRequest {
  name: string;
  type: string;
  icon?: string;
  latitude?: number;
  longitude?: number;
}

export interface GeofenceRequest {
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
}

export interface LocationUpdate {
  objectId: number;
  latitude: number;
  longitude: number;
}

export interface LocationBroadcast {
  objectId: number;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  outsideGeofence: boolean;
}

export interface Notification {
  userId: number;
  objectId: number;
  objectName: string;
  objectType: string;
  message: string;
  type: string;
  timestamp: string;
}
