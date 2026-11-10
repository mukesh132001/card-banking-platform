import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  template: `
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="topbar">
      <a class="brand" routerLink="/accounts">Card Banking</a>
      @if (auth.user(); as user) {
        <nav aria-label="Account">
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
