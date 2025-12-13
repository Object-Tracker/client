import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TrackedObject, TrackedObjectRequest, GeofenceRequest, User } from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class ObjectService {
  private readonly apiUrl = 'http://localhost:8081/api/v1';

  constructor(private http: HttpClient) {}

  getObjects(): Observable<TrackedObject[]> {
    return this.http.get<TrackedObject[]>(`${this.apiUrl}/objects`, { withCredentials: true });
  }

  getObject(id: number): Observable<TrackedObject> {
    return this.http.get<TrackedObject>(`${this.apiUrl}/objects/${id}`, { withCredentials: true });
  }

  createObject(request: TrackedObjectRequest): Observable<TrackedObject> {
    return this.http.post<TrackedObject>(`${this.apiUrl}/objects`, request, {
      withCredentials: true,
    });
  }

  updateObject(id: number, request: TrackedObjectRequest): Observable<TrackedObject> {
    return this.http.put<TrackedObject>(`${this.apiUrl}/objects/${id}`, request, {
      withCredentials: true,
    });
  }

  deleteObject(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/objects/${id}`, { withCredentials: true });
  }

  updateGeofence(request: GeofenceRequest): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/users/geofence`, request, { withCredentials: true });
  }
}
