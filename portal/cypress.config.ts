import { defineConfig } from 'cypress';

/**
 * End-to-end tests against the real stack: `ng serve` on :4200 proxying /api to account-service on :8080
 * (in-memory H2 with the demo data). `npm run e2e` starts the portal; start the API first.
 */
export default defineConfig({
  e2e: {
    baseUrl: 'http://127.0.0.1:4200',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: false,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 8000,
  },
});
