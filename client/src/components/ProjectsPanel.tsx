import { FormEvent, useState } from 'react';
import { api } from '../api/client';
import type { Complexity, EffortUnit, Project } from '../types';

const COLOURS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

interface Props {
  projects: Project[];
  onChanged: () => Promise<void>;
}

export function ProjectsPanel({ projects, onChanged }: Props) {
  const [editing, setEditing] = useState<Project | null>(null);
  const [title, setTitle] = useState('');
  const [complexity, setComplexity] = useState<Complexity>('Medium');
  const [effortAmount, setEffortAmount] = useState(5);
  const [effortUnit, setEffortUnit] = useState<EffortUnit>('days');
  const [notes, setNotes] = useState('');
  const [colour, setColour] = useState(COLOURS[0]);
  const [error, setError] = useState<string | null>(null);

  function startCreate() {
    setEditing(null);
    setTitle('');
    setComplexity('Medium');
    setEffortAmount(5);
    setEffortUnit('days');
    setNotes('');
    setColour(COLOURS[0]);
    setError(null);
  }

  function startEdit(p: Project) {
    setEditing(p);
    setTitle(p.title);
    setComplexity(p.complexity);
    setEffortAmount(p.effort_amount);
    setEffortUnit(p.effort_unit);
    setNotes(p.notes || '');
    setColour(p.colour || COLOURS[0]);
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const body = {
      title,
      complexity,
      effort_amount: effortAmount,
      effort_unit: effortUnit,
      notes: notes || null,
      colour,
    };
    try {
      if (editing) await api.updateProject(editing.id, body);
      else await api.createProject(body);
      startCreate();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  async function onDelete(id: number) {
    if (!confirm('Delete this project and its assignments?')) return;
    await api.deleteProject(id);
    if (editing?.id === id) startCreate();
    await onChanged();
  }

  return (
    <div className="panel-grid">
      <section className="card">
        <div className="card-head">
          <h2>Projects</h2>
          <button className="btn ghost sm" onClick={startCreate}>
            New
          </button>
        </div>
        <p className="hint">
          Complexity is a <strong>label only</strong> - duration uses effort x assignee FTEs.
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Complexity</th>
              <th>Effort</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} className={editing?.id === p.id ? 'selected' : ''}>
                <td>
                  <span className="swatch" style={{ background: p.colour }} />
                  <button className="link" onClick={() => startEdit(p)}>
                    {p.title}
                  </button>
                </td>
                <td>
                  <span className={`complexity c-${p.complexity.toLowerCase()}`}>
                    {p.complexity}
                  </span>
                </td>
                <td className="mono">
                  {p.effort_amount} {p.effort_unit}
                </td>
                <td className="actions">
                  <button className="btn ghost sm" onClick={() => startEdit(p)}>
                    Edit
                  </button>
                  <button className="btn danger sm" onClick={() => onDelete(p.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card form-card">
        <h2>{editing ? 'Edit project' : 'Add project'}</h2>
        <form onSubmit={onSubmit} className="form">
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label>
            Complexity <span className="muted">(label only)</span>
            <select
              value={complexity}
              onChange={(e) => setComplexity(e.target.value as Complexity)}
            >
              {(['Low', 'Medium', 'High', 'Critical'] as Complexity[]).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <div className="row2">
            <label>
              Effort
              <input
                type="number"
                min={0.1}
                step={0.5}
                value={effortAmount}
                onChange={(e) => setEffortAmount(Number(e.target.value))}
                required
              />
            </label>
            <label>
              Unit
              <select
                value={effortUnit}
                onChange={(e) => setEffortUnit(e.target.value as EffortUnit)}
              >
                <option value="days">days</option>
                <option value="weeks">weeks (x5)</option>
                <option value="months">months (x20)</option>
              </select>
            </label>
          </div>
          <label>
            Notes
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </label>
          <label>
            Colour
            <div className="colour-row">
              {COLOURS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={colour === c ? 'colour-dot active' : 'colour-dot'}
                  style={{ background: c }}
                  onClick={() => setColour(c)}
                />
              ))}
            </div>
          </label>
          {error && <p className="form-error">{error}</p>}
          <div className="form-actions">
            <button type="submit" className="btn primary">
              {editing ? 'Save' : 'Create'}
            </button>
            {editing && (
              <button type="button" className="btn ghost" onClick={startCreate}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
