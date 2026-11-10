import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { safeReturnUrl } from '../core/auth.guard';
import { AuthService } from '../core/auth.service';
import { friendlyError } from '../core/errors';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card narrow">
      <h1>Log in</h1>
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <label for="email">Email</label>
        <input id="email" type="email" formControlName="email" autocomplete="username"
               [attr.aria-invalid]="showError('email')" aria-describedby="email-error" />
        @if (showError('email')) {
          <p id="email-error" class="field-error">Enter a valid email address.</p>
        }

        <label for="password">Password</label>
        <input id="password" type="password" formControlName="password" autocomplete="current-password"
               [attr.aria-invalid]="showError('password')" aria-describedby="password-error" />
        @if (showError('password')) {
          <p id="password-error" class="field-error">Enter your password.</p>
        }

        <div aria-live="assertive">
          @if (error(); as message) {
            <p class="alert" role="alert">{{ message }}</p>
          }
        </div>

        <button type="submit" class="primary" [disabled]="submitting()">
          {{ submitting() ? 'Logging in…' : 'Log in' }}
        </button>
      </form>
      <details class="hint">
        <summary>Demo logins (local only)</summary>
        <p>alex.morgan&#64;example.com / alex-demo-password<br />priya.shah&#64;example.com / priya-demo-password<br />admin&#64;example.com / admin-demo-password (back office)</p>
      </details>
    </section>
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  showError(field: 'email' | 'password'): boolean {
    const control = this.form.controls[field];
    return control.invalid && control.touched;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    this.auth.login(email, password).subscribe({
      next: () => {
        // Customers land on /accounts, admins on /admin, unless they were sent here from a (same-site) page.
        const target = safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'), this.auth.homeUrl());
        this.router.navigateByUrl(target).catch(() => undefined);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(loginErrorMessage(err));
        this.form.controls.password.reset();
      },
    });
  }
}

/** 401 -> "Invalid email or password.", 423 -> the server's lockout message (when it ends), 0 -> server down. */
export function loginErrorMessage(err: unknown): string {
  return friendlyError(err, 'login');
}
