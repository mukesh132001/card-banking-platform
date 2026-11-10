import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { mockAlertsPlugin } from './mock/alertsMock';

// MOCK_ALERTS=false -> stream real alerts from notification-service instead of the dev mock.
const useMock = process.env.MOCK_ALERTS !== 'false';
const accountService = process.env.ACCOUNT_SERVICE_URL ?? 'http://localhost:8080';
const notificationService = process.env.NOTIFICATION_SERVICE_URL ?? 'http://localhost:8082';

export default defineConfig({
  plugins: [react(), ...(useMock ? [mockAlertsPlugin()] : [])],
  server: {
    port: 5173,
    proxy: {
      // SSE needs the proxy to pass the stream through unbuffered; http-proxy does this by default.
      '/api/alerts': { target: notificationService, changeOrigin: true },
      '/api': { target: accountService, changeOrigin: true },
    },
  },
});
