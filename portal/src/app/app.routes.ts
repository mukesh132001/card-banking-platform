import { Routes } from '@angular/router';

import { authGuard } from './core/auth.guard';
import { LoginComponent } from './login/login.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, title: 'Log in · Card Banking' },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'accounts' },
      {
        path: 'accounts',
        title: 'Your accounts · Card Banking',
        loadComponent: () => import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'accounts/:id',
        title: 'Transactions · Card Banking',
        loadComponent: () => import('./transactions/transactions.component').then((m) => m.TransactionsComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
