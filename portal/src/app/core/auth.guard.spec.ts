import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';

import { authGuard, safeReturnUrl } from './auth.guard';
import { AuthService } from './auth.service';

describe('authGuard', () => {
  let auth: AuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  function run(url: string): boolean | UrlTree | undefined {
    let result: boolean | UrlTree | undefined;
    const outcome = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    ) as Observable<boolean | UrlTree>;
    outcome.subscribe((r) => (result = r));
    return result;
  }

  it('lets a signed-in user through', () => {
    spyOn(auth, 'ensureSession').and.returnValue(of(true));
    expect(run('/accounts')).toBeTrue();
  });

  it('sends everyone else to /login and remembers where they were going', () => {
    spyOn(auth, 'ensureSession').and.returnValue(of(false));
    const result = run('/accounts/1');
    expect(result instanceof UrlTree).toBeTrue();
    expect(router.serializeUrl(result as UrlTree)).toBe('/login?returnUrl=%2Faccounts%2F1');
  });
});

describe('safeReturnUrl', () => {
  it('keeps same-site paths', () => {
    expect(safeReturnUrl('/accounts/1?page=2')).toBe('/accounts/1?page=2');
  });

  it('refuses anything that could leave the site', () => {
    for (const evil of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '', null]) {
      expect(safeReturnUrl(evil)).withContext(String(evil)).toBe('/accounts');
    }
  });
});
