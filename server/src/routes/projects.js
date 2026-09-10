import { Router } from 'express';
import db from '../db.js';

const COMPLEXITIES = new Set(['Low', 'Medium', 'High', 'Critical']);
const UNITS = new Set(['days', 'weeks', 'months']);

const router = Router();

router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM projects ORDER BY title COLLATE NOCASE').all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Project not found' });
  res.json(row);
});

router.post('/', (req, res) => {
  const {
    title,
    complexity = 'Medium',
    effort_amount,
    effort_unit = 'days',
    notes = null,
    colour = '#3B82F6',
  } = req.body || {};

  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  if (!COMPLEXITIES.has(complexity)) {
    return res.status(400).json({ error: 'invalid complexity' });
  }
  const amount = Number(effort_amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'effort_amount must be > 0' });
  }
  if (!UNITS.has(effort_unit)) {
    return res.status(400).json({ error: 'effort_unit must be days|weeks|months' });
  }

  const info = db
    .prepare(
      `INSERT INTO projects (title, complexity, effort_amount, effort_unit, notes, colour)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      String(title).trim(),
      complexity,
      amount,
      effort_unit,
      notes ? String(notes) : null,
      colour || '#3B82F6'
    );

  res.status(201).json(db.prepare('SELECT * FROM projects WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Project not found' });

  const title =
    req.body.title !== undefined ? String(req.body.title).trim() : existing.title;
  const complexity =
    req.body.complexity !== undefined ? req.body.complexity : existing.complexity;
  const effort_amount =
    req.body.effort_amount !== undefined
      ? Number(req.body.effort_amount)
      : existing.effort_amount;
  const effort_unit =
    req.body.effort_unit !== undefined ? req.body.effort_unit : existing.effort_unit;
  const notes =
    req.body.notes !== undefined
      ? req.body.notes
        ? String(req.body.notes)
        : null
      : existing.notes;
  const colour =
    req.body.colour !== undefined ? req.body.colour || '#3B82F6' : existing.colour;

  if (!title) return res.status(400).json({ error: 'title is required' });
  if (!COMPLEXITIES.has(complexity)) {
    return res.status(400).json({ error: 'invalid complexity' });
  }
  if (!Number.isFinite(effort_amount) || effort_amount <= 0) {
    return res.status(400).json({ error: 'effort_amount must be > 0' });
  }
  if (!UNITS.has(effort_unit)) {
    return res.status(400).json({ error: 'effort_unit must be days|weeks|months' });
  }

  db.prepare(
    `UPDATE projects SET title = ?, complexity = ?, effort_amount = ?, effort_unit = ?,
     notes = ?, colour = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(title, complexity, effort_amount, effort_unit, notes, colour, req.params.id);

  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Project not found' });
  res.status(204).end();
});

export default router;
