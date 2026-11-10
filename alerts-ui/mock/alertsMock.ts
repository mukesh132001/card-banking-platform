import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Dev-only stand-in for notification-service's SSE endpoint, so the feed works before the
 * Kafka pipeline (M3) exists. It speaks the same contract the real service will:
 *
 *   GET /api/alerts/stream   ->  text/event-stream
 *   event: fraud-alert
 *   id:    <alertId>          (the browser sends it back as Last-Event-ID on reconnect)
 *   data:  <FraudAlert JSON>  (see src/types/alert.ts)
 *
 * Turn it off with MOCK_ALERTS=false (npm run dev:live) to hit the real service through the proxy.
 */

const MERCHANTS = [
  { name: 'Unknown merchant, Lagos', country: 'NG', category: 'GENERAL' },
  { name: 'CryptoNow Exchange', country: 'MT', category: 'CRYPTO' },
  { name: 'Apple Store Online', country: 'IE', category: 'ELECTRONICS' },
  { name: 'Tesco', country: 'GB', category: 'GROCERIES' },
  { name: 'Shell', country: 'GB', category: 'FUEL' },
  { name: 'LuxWatch Boutique', country: 'AE', category: 'JEWELLERY' },
  { name: 'Steam Games', country: 'US', category: 'GAMING' },
  { name: 'Western Union', country: 'GB', category: 'MONEY_TRANSFER' },
];

const RULES: Record<string, string> = {
  FOREIGN_COUNTRY: 'Card used outside the home country',
  HIGH_AMOUNT: 'Amount far above this card\'s usual spend',
  VELOCITY: 'Several payments within 2 minutes',
  NEW_MERCHANT_HIGH_RISK: 'First payment to a high-risk merchant type',
  NIGHT_TIME: 'Payment at an unusual hour for this card',
};

const ACCOUNTS = [
  { accountId: 1, cardLast4: '1234' },
  { accountId: 2, cardLast4: '9876' },
];

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function makeAlert(seq: number) {
  const merchant = pick(MERCHANTS);
  const account = pick(ACCOUNTS);
  const foreign = merchant.country !== 'GB';
  // FOREIGN_COUNTRY fires exactly when the merchant is abroad; the other rules are random.
  const ruleIds = Object.keys(RULES)
    .filter((code) => code !== 'FOREIGN_COUNTRY')
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.floor(Math.random() * 3) + (foreign ? 0 : 1));
  if (foreign) ruleIds.unshift('FOREIGN_COUNTRY');
  const score = Math.min(0.99, 0.2 + ruleIds.length * 0.14 + Math.random() * 0.25);
  const amount = Math.round((score > 0.8 ? 400 + Math.random() * 2600 : 20 + Math.random() * 400) * 100) / 100;
  return {
    alertId: `alrt-${seq.toString().padStart(6, '0')}`,
    transactionId: `txn-${Date.now()}-${seq}`,
    accountId: account.accountId,
    cardLast4: account.cardLast4,
    merchant: merchant.name,
    merchantCountry: merchant.country,
    category: merchant.category,
    amount: amount.toFixed(2), // money travels as a string, like the BigDecimal it comes from
    currency: 'GBP',
    riskScore: Math.round(score * 100) / 100,
    reasons: ruleIds.map((code) => ({ code, description: RULES[code] })),
    occurredAt: new Date().toISOString(),
    status: 'OPEN',
  };
}

function send(res: ServerResponse, alert: ReturnType<typeof makeAlert>) {
  res.write(`event: fraud-alert\nid: ${alert.alertId}\ndata: ${JSON.stringify(alert)}\n\n`);
}

export function mockAlertsPlugin(): Plugin {
  let seq = 0;
  const recent: ReturnType<typeof makeAlert>[] = []; // last few alerts, replayed to new connections
  const publish = (res: ServerResponse, alert: ReturnType<typeof makeAlert>) => {
    recent.push(alert);
    if (recent.length > 5) recent.shift();
    send(res, alert);
  };
  return {
    name: 'mock-alerts-sse',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/alerts/stream', (req: IncomingMessage, res: ServerResponse) => {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        res.write('retry: 3000\n\n'); // reconnect delay the browser should use

        // Replay recent alerts (same ids, so the client de-duplicates), seeding a few on first start.
        // A browser reconnect sends Last-Event-ID; the real service would replay only what came after it.
        if (recent.length === 0) for (let i = 0; i < 3; i++) recent.push(makeAlert(++seq));
        const lastId = req.headers['last-event-id'];
        const from = lastId ? recent.findIndex((a) => a.alertId === lastId) + 1 : 0;
        recent.slice(from).forEach((a) => send(res, a));

        let timer: NodeJS.Timeout;
        const next = () => {
          timer = setTimeout(() => {
            publish(res, makeAlert(++seq));
            next();
          }, 3000 + Math.random() * 4000);
        };
        next();
        const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 15000);

        req.on('close', () => {
          clearTimeout(timer);
          clearInterval(heartbeat);
        });
      });
    },
  };
}
