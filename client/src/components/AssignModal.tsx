import { FormEvent, useState } from 'react';
import { api } from '../api/client';
import type { Person, Project } from '../types';

interface Props {
  people: Person[];
  projects: Project[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function AssignModal({ people, projects, onClose, onSaved }: Props) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? 0);
  const [selected, setSelected] = useState<number[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggle(id: number) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!projectId || !selected.length) {
      setError('Pick a project and at least one person');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.createAssignment({
        project_id: projectId,
        person_ids: selected,
        start_date: startDate,
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  const totalFte = people
    .filter((p) => selected.includes(p.id))
    .reduce((s, p) => s + p.fte, 0);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Assign project</h2>
          <button className="btn ghost sm" onClick={onClose}>
            x
          </button>
        </div>
        <form onSubmit={onSubmit} className="form">
          <label>
            Project
            <select
              value={projectId}
              onChange={(e) => setProjectId(Number(e.target.value))}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} | {p.effort_amount} {p.effort_unit}
                </option>
              ))}
            </select>
          </label>
          <label>
            Start date
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </label>
          <fieldset className="check-list">
            <legend>
              People <span className="muted">(multi-assign = parallel)</span>
            </legend>
            {people.map((p) => (
              <label key={p.id} className="check-row">
                <input
                  type="checkbox"
                  checked={selected.includes(p.id)}
                  onChange={() => toggle(p.id)}
                />
                <span>
                  {p.name}
                  <span className="muted"> | {p.fte} FTE</span>
                </span>
              </label>
            ))}
          </fieldset>
          {selected.length > 0 && (
            <p className="hint">
              Combined FTE: <strong>{totalFte.toFixed(1)}</strong> - calendar days ~ effort /{' '}
              {totalFte.toFixed(1)}
            </p>
          )}
          {error && <p className="form-error">{error}</p>}
          <div className="form-actions">
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Saving...' : 'Assign'}
            </button>
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
