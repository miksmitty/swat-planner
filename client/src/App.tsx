import { useCallback, useEffect, useState } from 'react';
import { api } from './api/client';
import type { TimelineData } from './types';
import { Timeline } from './components/Timeline';
import { PeoplePanel } from './components/PeoplePanel';
import { ProjectsPanel } from './components/ProjectsPanel';
import { AssignModal } from './components/AssignModal';

type Tab = 'timeline' | 'people' | 'projects';

export default function App() {
  const [tab, setTab] = useState<Tab>('timeline');
  const [data, setData] = useState<TimelineData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [assignOpen, setAssignOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const t = await api.getTimeline();
      setData(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const people = data?.people ?? [];
  const projects = data?.projects ?? [];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">SW</span>
          <div>
            <h1>SWAT Planner</h1>
            <p className="subtitle">Resource timeline | FTE-scaled duration</p>
          </div>
        </div>
        <nav className="tabs">
          {(
            [
              ['timeline', 'Timeline'],
              ['people', 'People'],
              ['projects', 'Projects'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              className={tab === id ? 'tab active' : 'tab'}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="top-actions">
          <button className="btn primary" onClick={() => setAssignOpen(true)}>
            + Assign
          </button>
          <button className="btn ghost" onClick={refresh} title="Refresh">
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="banner error">
          {error}
          <button className="btn ghost sm" onClick={refresh}>
            Retry
          </button>
        </div>
      )}

      <main className="main">
        {loading && !data ? (
          <div className="empty">Loading...</div>
        ) : tab === 'timeline' && data ? (
          <Timeline data={data} onChanged={refresh} />
        ) : tab === 'people' ? (
          <PeoplePanel
            people={people}
            onChanged={async () => {
              await refresh();
            }}
          />
        ) : (
          <ProjectsPanel
            projects={projects}
            onChanged={async () => {
              await refresh();
            }}
          />
        )}
      </main>

      {assignOpen && (
        <AssignModal
          people={people}
          projects={projects}
          onClose={() => setAssignOpen(false)}
          onSaved={async () => {
            setAssignOpen(false);
            await refresh();
          }}
        />
      )}
    </div>
  );
}
