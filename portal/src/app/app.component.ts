import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="topbar">
      <a class="brand" [routerLink]="auth.homeUrl()">Card Banking</a>
      @if (auth.user(); as user) {
        <nav aria-label="Main">
          @if (auth.hasRole('CUSTOMER')) {
            <a routerLink="/accounts" routerLinkActive="active" ariaCurrentWhenActive="page">Accounts</a>
          }
          @if (auth.hasRole('ADMIN')) {
            <a routerLink="/admin" routerLinkActive="active" ariaCurrentWhenActive="page">Back office</a>
          }
          <span class="who">{{ user.email }}</span>
          <button type="button" class="link-button" (click)="auth.logout()">Log out</button>
        </nav>
      }
    </header>
    <main id="main" tabindex="-1">
      <router-outlet />
    </main>
  `,
})
export class AppComponent {
  protected readonly auth = inject(AuthService);
}
