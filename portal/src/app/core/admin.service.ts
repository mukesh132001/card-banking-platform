import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AdminCustomer, AdminUser } from './api.models';

/** Back-office endpoints. The API enforces the ADMIN role; the route guard only keeps customers off the page. */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);

  users(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>('/api/admin/users');
  }

  customers(): Observable<AdminCustomer[]> {
    return this.http.get<AdminCustomer[]>('/api/admin/customers');
  }

  unlock(userId: number): Observable<void> {
    return this.http.post<void>(`/api/admin/users/${userId}/unlock`, null);
  }
}
