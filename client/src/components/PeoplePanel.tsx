import { FormEvent, useState } from 'react';
import { api } from '../api/client';
import type { Person } from '../types';

interface Props {
  people: Person[];
  onChanged: () => Promise<void>;
}

export function PeoplePanel({ people, onChanged }: Props) {
  const [editing, setEditing] = useState<Person | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [fte, setFte] = useState(1);
  const [error, setError] = useState<string | null>(null);

  function startCreate() {
    setEditing(null);
    setName('');
    setRole('');
    setFte(1);
    setError(null);
  }

  function startEdit(p: Person) {
    setEditing(p);
    setName(p.name);
    setRole(p.role || '');
    setFte(p.fte);
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editing) {
        await api.updatePerson(editing.id, { name, role: role || null, fte });
      } else {
        await api.createPerson({ name, role: role || null, fte });
      }
      startCreate();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  async function onDelete(id: number) {
    if (!confirm('Delete this person and their assignments?')) return;
    await api.deletePerson(id);
    if (editing?.id === id) startCreate();
    await onChanged();
  }

  return (
    <div className="panel-grid">
      <section className="card">
        <div className="card-head">
          <h2>People</h2>
          <button className="btn ghost sm" onClick={startCreate}>
            New
          </button>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>FTE</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} className={editing?.id === p.id ? 'selected' : ''}>
                <td>
                  <button className="link" onClick={() => startEdit(p)}>
                    {p.name}
                  </button>
                </td>
                <td className="muted">{p.role || '-'}</td>
                <td>
                  <span className="pill">{p.fte.toFixed(1)}</span>
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
        <h2>{editing ? 'Edit person' : 'Add person'}</h2>
        <form onSubmit={onSubmit} className="form">
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Role <span className="muted">(optional)</span>
            <input value={role} onChange={(e) => setRole(e.target.value)} />
          </label>
          <label>
            FTE (0-1)
            <input
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={fte}
              onChange={(e) => setFte(Number(e.target.value))}
              required
            />
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
