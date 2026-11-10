import { Routes } from '@angular/router';

import { guestGuard, roleGuard } from './core/auth.guard';

/**
 * Every page is lazy-loaded, so the first download is just the shell + router; each page's code arrives the first
 * time it is opened. Customer pages need CUSTOMER, the back office needs ADMIN.
 */
export const routes: Routes = [
  {
    path: 'login',
    title: 'Log in · Card Banking',
    canActivate: [guestGuard],
    loadComponent: () => import('./login/login.component').then((m) => m.LoginComponent),
  },
  { path: '', pathMatch: 'full', redirectTo: 'accounts' },
  {
    path: 'accounts',
    canActivate: [roleGuard('CUSTOMER')],
    children: [
      {
        path: '',
        title: 'Your accounts · Card Banking',
        loadComponent: () => import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: ':id',
        title: 'Transactions · Card Banking',
        loadComponent: () => import('./transactions/transactions.component').then((m) => m.TransactionsComponent),
      },
    ],
  },
  {
    path: 'admin',
    title: 'Back office · Card Banking',
    canActivate: [roleGuard('ADMIN')],
    loadComponent: () => import('./admin/admin.component').then((m) => m.AdminComponent),
  },
  { path: '**', redirectTo: 'accounts' },
];
