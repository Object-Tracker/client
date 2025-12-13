import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LocationUpdate, TrackedObject } from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class LocationService {
  private readonly apiUrl = 'http://localhost:8082/api/v1/locations';

  constructor(private http: HttpClient) {}

  updateLocation(update: LocationUpdate): Observable<TrackedObject> {
    return this.http.post<TrackedObject>(`${this.apiUrl}/update`, update, {
      withCredentials: true,
    });
  }

  getAllLocations(): Observable<TrackedObject[]> {
    return this.http.get<TrackedObject[]>(this.apiUrl, { withCredentials: true });
  }
}
