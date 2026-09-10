import { Router } from 'express';
import db from '../db.js';
import { computeSpan } from '../duration.js';

const router = Router();

function enrichAssignment(row) {
  if (!row) return null;
  const siblings = db
    .prepare(
      `SELECT a.*, p.fte, p.name AS person_name
       FROM assignments a
       JOIN people p ON p.id = a.person_id
       WHERE a.project_id = ?`
    )
    .all(row.project_id);

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(row.project_id);
  const ftes = siblings.map((s) => s.fte);
  // Shared calendar span: use the earliest start among siblings for the project group,
  // but each row displays from its own start_date with the same calendar length.
  const span = computeSpan(
    row.start_date,
    project.effort_amount,
    project.effort_unit,
    ftes
  );

  return {
    ...row,
    project,
    person_name: siblings.find((s) => s.id === row.id)?.person_name,
    assignees: siblings.map((s) => ({
      assignment_id: s.id,
      person_id: s.person_id,
      person_name: s.person_name,
      fte: s.fte,
      start_date: s.start_date,
    })),
    ...span,
  };
}

router.get('/', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT a.* FROM assignments a
       ORDER BY a.start_date, a.id`
    )
    .all();
  res.json(rows.map(enrichAssignment));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Assignment not found' });
  res.json(enrichAssignment(row));
});

router.post('/', (req, res) => {
  const { project_id, person_id, start_date, person_ids } = req.body || {};

  if (!project_id || !start_date) {
    return res.status(400).json({ error: 'project_id and start_date are required' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date)) {
    return res.status(400).json({ error: 'start_date must be YYYY-MM-DD' });
  }

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(project_id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const ids = person_ids?.length
    ? person_ids
    : person_id
      ? [person_id]
      : [];

  if (!ids.length) {
    return res.status(400).json({ error: 'person_id or person_ids required' });
  }

  const insert = db.prepare(
    `INSERT INTO assignments (project_id, person_id, start_date)
     VALUES (?, ?, ?)
     ON CONFLICT(project_id, person_id) DO UPDATE SET
       start_date = excluded.start_date,
       updated_at = datetime('now')`
  );

  const created = [];
  const tx = db.transaction(() => {
    for (const pid of ids) {
      const person = db.prepare('SELECT * FROM people WHERE id = ?').get(pid);
      if (!person) throw new Error(`Person ${pid} not found`);
      const info = insert.run(project_id, pid, start_date);
      const id = info.lastInsertRowid || db.prepare(
        'SELECT id FROM assignments WHERE project_id = ? AND person_id = ?'
      ).get(project_id, pid).id;
      created.push(id);
    }
  });

  try {
    tx();
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const rows = created.map((id) =>
    enrichAssignment(db.prepare('SELECT * FROM assignments WHERE id = ?').get(id))
  );
  res.status(201).json(rows.length === 1 ? rows[0] : rows);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Assignment not found' });

  let person_id =
    req.body.person_id !== undefined ? Number(req.body.person_id) : existing.person_id;
  let start_date =
    req.body.start_date !== undefined ? req.body.start_date : existing.start_date;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date)) {
    return res.status(400).json({ error: 'start_date must be YYYY-MM-DD' });
  }

  const person = db.prepare('SELECT * FROM people WHERE id = ?').get(person_id);
  if (!person) return res.status(404).json({ error: 'Person not found' });

  // If reassigning to someone already on this project, merge: move start and drop duplicate
  const conflict = db
    .prepare(
      `SELECT * FROM assignments WHERE project_id = ? AND person_id = ? AND id != ?`
    )
    .get(existing.project_id, person_id, existing.id);

  if (conflict) {
    db.prepare(
      `UPDATE assignments SET start_date = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(start_date, conflict.id);
    db.prepare('DELETE FROM assignments WHERE id = ?').run(existing.id);
    return res.json(enrichAssignment(db.prepare('SELECT * FROM assignments WHERE id = ?').get(conflict.id)));
  }

  // When moving start for one assignee of a multi-assign, sync all siblings to same start
  // so the shared calendar span stays aligned (product rule: same calendar span on each row).
  const syncSiblings = req.body.sync_siblings !== false;

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE assignments SET person_id = ?, start_date = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(person_id, start_date, existing.id);

    if (syncSiblings && start_date !== existing.start_date) {
      db.prepare(
        `UPDATE assignments SET start_date = ?, updated_at = datetime('now')
         WHERE project_id = ? AND id != ?`
      ).run(start_date, existing.project_id, existing.id);
    }
  });
  tx();

  res.json(enrichAssignment(db.prepare('SELECT * FROM assignments WHERE id = ?').get(existing.id)));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM assignments WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Assignment not found' });
  res.status(204).end();
});

export default router;
