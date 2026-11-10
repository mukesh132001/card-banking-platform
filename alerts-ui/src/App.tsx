import { AlertsFeed } from './components/AlertsFeed';

const STREAM_URL = import.meta.env.VITE_ALERTS_STREAM_URL ?? '/api/alerts/stream';

export function App() {
  return (
    <div className="app">
      <header className="topbar">
        <span className="topbar__logo" aria-hidden="true">◆</span>
        <h1 className="topbar__title">Card Alerts</h1>
      </header>
      <main className="app__main">
        <AlertsFeed streamUrl={STREAM_URL} />
      </main>
    </div>
  );
}
