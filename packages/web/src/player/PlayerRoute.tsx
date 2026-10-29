// Placeholder until the player runtime (#27). Shows that the browser reaches the server.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';

type Server = 'checking' | 'reachable' | 'unreachable';

export function PlayerRoute() {
  const { stationId } = useParams();
  const [server, setServer] = useState<Server>('checking');

  useEffect(() => {
    let active = true;
    // Errors are handled in the chain itself, so the effect does not wait for the promise.
    void fetch('/api/health')
      .then((response) => response.ok)
      .catch(() => false)
      .then((ok) => {
        if (active) setServer(ok ? 'reachable' : 'unreachable');
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-app p-6">
      <div className="rounded-lg bg-surface p-6 shadow-1">
        <h1 className="text-heading-l">Player · {stationId}</h1>
        <p className="text-body-m text-secondary">Server: {server}</p>
      </div>
    </main>
  );
}
