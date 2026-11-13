import { Gantt, type AccessRules } from '@gantt/react';
import '@gantt/react/src/gantt.css';
import { useEffect, useState } from 'react';

/**
 * View-only: the server is the authority (constitution III) and this spec has no editing, so the
 * browser is given `view` and nothing else, and `readOnly` switches the editing controls off. They
 * only hide and disable; they grant nothing. FR-005.
 */
const VIEW_ONLY: AccessRules = {
  subject: { id: 'anonymous' },
  rules: [{ effect: 'allow', permissions: ['view', 'view.fields', 'view.baselines', 'view.resources'] }],
};

type Loaded =
  { state: 'loading' } | { state: 'error' } | { state: 'ready'; data: React.ComponentProps<typeof Gantt>['data'] };

/** Fetches the sample roadmap from the service (FR-004) and shows it, or one plain message (FR-011a). */
export function App() {
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  useEffect(() => {
    fetch('/api/roadmaps/sample')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => setLoaded({ state: 'ready', data }))
      .catch(() => setLoaded({ state: 'error' }));
  }, []);

  if (loaded.state === 'error') return <p role="alert">The roadmap could not be loaded. Try again in a moment.</p>;
  if (loaded.state === 'loading') return <p>Loading the roadmap…</p>;
  return <Gantt data={loaded.data} access={VIEW_ONLY} readOnly height={640} />;
}
